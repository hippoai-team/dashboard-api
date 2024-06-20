const axios = require('axios');
const { EC2Client, StartInstancesCommand, StopInstancesCommand, DescribeInstanceStatusCommand, DescribeInstancesCommand, waitUntilInstanceRunning, waitUntilInstanceStopped } = require('@aws-sdk/client-ec2');
const express = require('express');
const { Client } = require('ssh2');
const router = express.Router();

const ec2 = new EC2Client({
  credentials: {
    accessKeyId: process.env.EC2_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.EC2_AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.EC2_AWS_REGION,
});

const waitForStoppedState = async (instanceId) => {
    const params = { InstanceIds: [instanceId] };
  
    await waitUntilInstanceStopped({ client: ec2, maxWaitTime: 300, minDelay: 5 }, params);
};

const waitForRunningState = async (instanceId) => {
    const params = { InstanceIds: [instanceId] };
    await waitUntilInstanceRunning({ client: ec2, maxWaitTime: 300, minDelay: 5 }, params);
  };

exports.start = async (req, res) => {
    const instanceId = process.env.EC2_INSTANCE_ID; // Store your EC2 instance ID securely

    try {
      // Check instance state and wait if it's stopping
      await waitForStoppedState(instanceId);
  
      // Start EC2 instance
      const startParams = { InstanceIds: [instanceId] };
      await ec2.send(new StartInstancesCommand(startParams));
  
      // Wait for the instance to be in running state
      await waitForRunningState(instanceId);
  
      // Get the public DNS of the instance
      const describeParams = { InstanceIds: [instanceId] };
      const instanceData = await ec2.send(new DescribeInstancesCommand(describeParams));
      const publicDns = instanceData.Reservations[0].Instances[0].PublicDnsName;
      // SSH into the instance and run Docker container
      const conn = new Client();
      conn.on('ready', () => {
        console.log('SSH connection established');
        conn.exec('sudo docker start ingestion-pipeline', (err, stream) => {
          if (err) throw err;
          stream.on('close', (code, signal) => {
            console.log('Stream closed with code:', code, 'and signal:', signal);
            conn.end();
            res.status(200).json({ message: 'EC2 instance started and Docker container launched successfully' });
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
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Failed to start EC2 instance and launch Docker container', error });
    }
}

exports.stop = async (req, res) => {
    const instanceId = process.env.EC2_INSTANCE_ID; // Store your EC2 instance ID securely

    try {
      // Stop EC2 instance
      const stopParams = { InstanceIds: [instanceId] };
      await ec2.send(new StopInstancesCommand(stopParams));
  
      // Wait for the instance to be in stopped state
      await waitForStoppedState(instanceId);
  
      res.status(200).json({ message: 'EC2 instance stopped successfully' });
    } catch (error) {
      console.error('Error stopping EC2 instance:', error);
      res.status(500).json({ message: 'Failed to stop EC2 instance', error });
    }

}

exports.check_instance_state = async (req, res) => {
  const instanceId = process.env.EC2_INSTANCE_ID; // Store your EC2 instance ID securely
  const params = { InstanceIds: [instanceId] , IncludeAllInstances: true };
  const data = await ec2.send(new DescribeInstanceStatusCommand(params));
  const state = data.InstanceStatuses[0].InstanceState.Name;
  res.status(200).json({ state });
}
