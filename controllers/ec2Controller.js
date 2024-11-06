const axios = require('axios');
const { EC2Client, StartInstancesCommand, StopInstancesCommand, DescribeInstanceStatusCommand, DescribeInstancesCommand, waitUntilInstanceRunning, waitUntilInstanceStopped } = require('@aws-sdk/client-ec2');
const express = require('express');
const { Client } = require('ssh2');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();

const ec2 = new EC2Client({
  credentials: {
    region: 'us-east-1',
    accessKeyId: process.env.EC2_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.EC2_AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.EC2_AWS_REGION,
});

const waitForStoppedState = async (instanceId) => {
    const params = { InstanceIds: [instanceId] };
    await waitUntilInstanceStopped({ client: ec2, maxWaitTime: 1000, minDelay: 10 }, params);
};

const waitForRunningState = async (instanceId) => {
    const params = { InstanceIds: [instanceId] };
    await waitUntilInstanceRunning({ client: ec2, maxWaitTime: 1000, minDelay: 10 }, params);
};

const waitForInstanceStatusChecks = async (instanceId) => {
  const params = { InstanceIds: [instanceId], IncludeAllInstances: true };
  while (true) {
    const data = await ec2.send(new DescribeInstanceStatusCommand(params));
    const instanceStatus = data.InstanceStatuses[0];
    if (instanceStatus && instanceStatus.InstanceStatus.Status === 'ok' && instanceStatus.SystemStatus.Status === 'ok') {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds before checking again
  }
};

const checkDockerContainerStatus = (publicDns) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log('SSH connection established');
      conn.exec('sudo docker ps --filter "name=ingestion-pipeline" --filter "status=running" --format "{{.Names}}"', (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
        }).on('close', () => {
          conn.end();
          resolve(output.includes('ingestion-pipeline'));
        }).stderr.on('data', (data) => {
          console.log('STDERR:', data.toString());
        });
      });
    }).connect({
      host: publicDns,
      username: process.env.EC2_USERNAME,
      privateKey: process.env.EC2_PRIVATE_KEY
    });
  });
};

const startDockerContainer = (publicDns) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log('SSH connection established');
      conn.exec('sudo docker start ingestion-pipeline', (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        stream.on('close', (code, signal) => {
          console.log('Stream closed with code:', code, 'and signal:', signal);
          conn.end();
          resolve();
        }).on('data', (data) => {
          console.log('STDOUT:', data.toString());
        }).stderr.on('data', (data) => {
          console.log('STDERR:', data.toString());
        });
      });
    }).connect({
      host: publicDns,
      username: process.env.EC2_USERNAME,
      privateKey: process.env.EC2_PRIVATE_KEY
    });
  });
};

const stopDockerContainer = (publicDns) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec('sudo docker stop ingestion-pipeline', (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        stream.on('close', (code, signal) => {
          console.log('Stream closed with code:', code, 'and signal:', signal);
          conn.end();
          resolve();
        }).on('data', (data) => {
          console.log('STDOUT:', data.toString());
        }).stderr.on('data', (data) => {
          console.log('STDERR:', data.toString());
        });
      });
    }).connect({
      host: publicDns,
      username: process.env.EC2_USERNAME,
      privateKey: process.env.EC2_PRIVATE_KEY
    });
  });
};
      
  

exports.startInstance = async (req, res) => {
  const instanceId = process.env.EC2_INSTANCE_ID;
  console.log('starting instance with id', instanceId)
  try {
    const describeParams = { InstanceIds: [instanceId] };
    const instanceData = await ec2.send(new DescribeInstancesCommand(describeParams));
    const instanceState = instanceData.Reservations[0].Instances[0].State.Name;
    console.log('instance state', instanceState)

    if (instanceState === 'running') {
      return res.status(200).json({ message: 'EC2 instance is already running' });
    }

    await ec2.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
    await waitForRunningState(instanceId);
    await waitForInstanceStatusChecks(instanceId);

    res.status(200).json({ message: 'EC2 instance started successfully' });
  } catch (error) {
    console.error('Error starting EC2 instance:', error);
    res.status(500).json({ message: 'Failed to start EC2 instance', error });
  }
};

exports.stopInstance = async (req, res) => {
  const instanceId = process.env.EC2_INSTANCE_ID;

  try {
    const describeParams = { InstanceIds: [instanceId] };
    const instanceData = await ec2.send(new DescribeInstancesCommand(describeParams));
    const instanceState = instanceData.Reservations[0].Instances[0].State.Name;

    if (instanceState === 'stopped') {
      return res.status(200).json({ message: 'EC2 instance is already stopped' });
    }

    await ec2.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
    await waitForStoppedState(instanceId);

    res.status(200).json({ message: 'EC2 instance stopped successfully' });
  } catch (error) {
    console.error('Error stopping EC2 instance:', error);
    res.status(500).json({ message: 'Failed to stop EC2 instance', error });
  }
};

exports.checkInstanceState = async (req, res) => {
  const instanceId = process.env.EC2_INSTANCE_ID;
  const params = { InstanceIds: [instanceId], IncludeAllInstances: true };

  try {
    const data = await ec2.send(new DescribeInstanceStatusCommand(params));
    const state = data.InstanceStatuses[0]?.InstanceState?.Name || 'unknown';
    res.status(200).json({ state });
  } catch (error) {
    console.error('Error checking instance state:', error);
    res.status(500).json({ message: 'Failed to check EC2 instance state', error });
  }
};

exports.checkDockerStatus = async (req, res) => {
  const instanceId = process.env.EC2_INSTANCE_ID;

  try {
    const describeParams = { InstanceIds: [instanceId] };
    const instanceData = await ec2.send(new DescribeInstancesCommand(describeParams));
    const publicDns = instanceData.Reservations[0].Instances[0].PublicDnsName;

    const isDockerRunning = await checkDockerContainerStatus(publicDns);
    res.status(200).json({ isDockerRunning });
  } catch (error) {
    console.error('Error checking Docker container status:', error);
    res.status(500).json({ message: 'Failed to check Docker container status', error });
  }
};

exports.startDockerContainer = async (req, res) => {
  const instanceId = process.env.EC2_INSTANCE_ID;

  try {
    const describeParams = { InstanceIds: [instanceId] };
    const instanceData = await ec2.send(new DescribeInstancesCommand(describeParams));
    const publicDns = instanceData.Reservations[0].Instances[0].PublicDnsName;

    await startDockerContainer(publicDns);
    res.status(200).json({ message: 'Docker container started successfully' });
  } catch (error) {
    console.error('Error starting Docker container:', error);
    res.status(500).json({ message: 'Failed to start Docker container', error });
  }
};

exports.stopDockerContainer = async (req, res) => {
  const instanceId = process.env.EC2_INSTANCE_ID;

  try {
    const describeParams = { InstanceIds: [instanceId] };
    const instanceData = await ec2.send(new DescribeInstancesCommand(describeParams));
    const publicDns = instanceData.Reservations[0].Instances[0].PublicDnsName;

    await stopDockerContainer(publicDns);
    res.status(200).json({ message: 'Docker container stopped successfully' });
  } catch (error) {
    console.error('Error stopping Docker container:', error);
    res.status(500).json({ message: 'Failed to stop Docker container', error });
  }
}


