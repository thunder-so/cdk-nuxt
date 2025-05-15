'use strict';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

exports.handler = async (event, context, callback) => {
  const response = event.Records[0].cf.response;
  const request = event.Records[0].cf.request;
  const host = event.Records[0].cf.config.distributionDomainName;

  if (response.status == '404') {
    const s3Client = new S3Client({ region: process.env.REGION });

    const bucketParams = {
      Bucket: process.env.BUCKET,
      Key: request.uri.endsWith('/') 
        ? request.uri + 'index.html' 
        : request.uri + '/index.html',
    };

    try {
      // Check if file exists
      await s3Client.send(new GetObjectCommand(bucketParams));

      // Return a 302 redirect response
      return {
        status: '302',
        statusDescription: 'Found',
        headers: {
          'location': [{ key: 'Location', value: 'https://' + host + bucketParams.Key }],
        }
      };
    } catch (err) {
      // File does not exist, return the original response
      return response;
    }

  // S3 origin returned 403 Access Denied for index.html, return a true 404
  } else if (response.status == '403') {
    return {
      status: '404',
      statusDescription: 'Not Found',
      headers: response.headers,
      body: '<h1>404 Not Found</h1>',
    };
    
  } else {
    // passthrough all else
    return response;
  }
};