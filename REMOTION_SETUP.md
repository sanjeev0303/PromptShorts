# Remotion Lambda Setup Guide

This document explains how to set up Remotion Lambda for video rendering in production.

## Current Status

The application is currently running in **development mode** with mock video rendering. The actual video rendering using Remotion Lambda requires AWS Lambda function deployment.

## Development Mode

In development mode (`NODE_ENV=development`), the system uses mock video rendering:
- Simulates rendering delay (3 seconds)
- Returns a placeholder video URL
- Allows testing of all other functionality without Lambda setup

## Production Setup

To enable actual video rendering in production, you need to:

### 1. Deploy Remotion Lambda Function

```bash
# Install Remotion CLI
npm install -g @remotion/cli

# Deploy the Lambda function
npx remotion lambda sites create src/Video.tsx --site-name=shorts69
npx remotion lambda functions deploy --region=ap-south-1 --memory=2048 --timeout=120 --disk=2048
```

### 2. Update Environment Variables

Add these environment variables for production:

```env
NODE_ENV=production
AWS_REGION=ap-south-1
REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-4-0-311-mem2048mb-disk2048mb-120sec
```

### 3. Create Remotion Video Component

Create a `src/Video.tsx` file with your video composition:

```tsx
import {Composition} from 'remotion';
import {MyVideo} from './MyVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyVideo"
        component={MyVideo}
        durationInFrames={900} // 30 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
```

### 4. AWS Permissions

Ensure your AWS credentials have the following permissions:
- `lambda:InvokeFunction`
- `s3:GetObject`
- `s3:PutObject`
- `logs:CreateLogGroup`
- `logs:CreateLogStream`
- `logs:PutLogEvents`

## Current Configuration

The current render configuration in `src/action/render.ts`:
- **Region**: `ap-south-1`
- **Function Name**: `remotion-render-4-0-311-mem2048mb-disk2048mb-120sec`
- **Serve URL**: `https://remotionlambda-apsouth1-s689byx4j6.s3.ap-south-1.amazonaws.com/sites/shorts69/index.html`
- **Composition**: `MyVideo`
- **Codec**: `h264`

## Testing

To test the current system without Lambda setup:
1. Ensure `NODE_ENV=development` (default in Next.js dev mode)
2. The system will automatically use mock rendering
3. All other functionality (script generation, image generation, audio generation, captions) works normally

## Switching to Production

To switch to production rendering:
1. Complete the Lambda deployment steps above
2. Set `NODE_ENV=production`
3. Restart the application

## Cost Considerations

Remotion Lambda charges for:
- Lambda execution time
- S3 storage for rendered videos
- S3 bandwidth for video delivery

Estimate ~$0.01-0.05 per 30-second video depending on complexity.
