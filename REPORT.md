# Classhi — Project Report

**CS 1660: Cloud Computing**
**Team:** Shreyash Ranjan, Akash Krishnakanth, Aidan, Krishna Katakota, Haiden
**Submitted:** April 2026

---

## What We Built

Classhi is a prediction market platform built specifically for CS 1660 lectures. The idea is simple: students place play-money bets on things that happen in class — "Will Dan say 'serverless' more than 10 times tonight?", "Will a student ask what S3 stands for?", "Will class end early?" — and when class ends, Dan resolves the markets and winners get paid out.

The motivation came from noticing how easy it is to zone out during a two-hour evening lecture. If you have $50 riding on whether the professor references Netflix as a cloud example, you're suddenly paying a lot more attention. The leaderboard also creates a competitive angle across the class that keeps people engaged week to week.

From a technical standpoint, we wanted to build something that was fully serverless and would actually run in production — not just on localhost. Everything deploys from a single `sam deploy` and the live version is at [d1vrs4hix1vyxh.cloudfront.net](https://d1vrs4hix1vyxh.cloudfront.net).

---

## Architecture Overview

The stack is entirely AWS-managed — no EC2, no containers, no self-managed databases. The frontend is a React SPA built with Vite and Tailwind CSS, hosted in a private S3 bucket and served through CloudFront. All authentication runs through Amazon Cognito. The backend is a set of Lambda functions behind API Gateway, and data lives in DynamoDB.

The most interesting architectural piece is the real-time pricing. When a student places a bet, DynamoDB Streams picks up the write and triggers a broadcast Lambda that pushes the updated price to every connected client over WebSocket. The whole path from bet placement to price update on other screens takes under 3 seconds. We didn't use SNS or SQS for this because DynamoDB Streams already gives us the event we need — adding a queue in between would just be extra complexity for no real gain.

For market scheduling, we used EventBridge Scheduler to automatically transition markets from `scheduled → open → closed` at the right times. Each market gets its own one-time schedule when it's created, and the schedules delete themselves after firing. This was way cleaner than running a cron job that polls DynamoDB every minute.

---

## AWS Services Used

We used 9 AWS services for this project. Here's why we picked each one:

**Amazon Cognito** handled authentication. We didn't want to build our own login system — Cognito gives you email/password sign-up, JWT tokens, and a PostConfirmation trigger we hooked into to give each new user their starting $1000 balance. It just made sense to use a managed service for this rather than rolling our own.

**API Gateway (HTTP API)** sits in front of all the REST endpoints. We used the HTTP API variant specifically because it has native JWT authorization built in — you give it the Cognito User Pool details and it validates tokens automatically without needing a custom Lambda for auth. It's also cheaper than the older REST API type.

**API Gateway (WebSocket API)** handles the real-time connections. This was actually one of the trickier parts — browsers can't send custom headers when opening a WebSocket connection, so you can't pass a Bearer token the normal way. We had to pass the Cognito ID token as a query string parameter and validate it in a Lambda authorizer.

**AWS Lambda** runs all the business logic. We ended up with 15 separate functions — one per route basically. They're all TypeScript, running on Node.js 20 with ARM64 (Graviton2) processors, which saves about 20% on compute cost compared to x86. Lambda worked well here because the load is bursty and unpredictable, and we didn't want to pay for idle compute.

**Amazon DynamoDB** stores everything — users, markets, positions, and active WebSocket connections. The key feature we relied on was `TransactWriteItems`, which lets us atomically deduct a user's balance and update market volume in the same operation. Without that, two simultaneous bets could read the same balance and both go through even if the user couldn't afford both.

**DynamoDB Streams** is how we do real-time price updates. Every time a market's price changes in DynamoDB, Streams emits an event that triggers our broadcast Lambda. That Lambda then looks up who's connected to that market and pushes the update to them over WebSocket. Separating the broadcast from the bet-placement path means a slow or disconnected client doesn't slow down the actual bet.

**EventBridge Scheduler** handles market lifecycle. When a market is created with an open time of 6pm, we create a one-time schedule that fires at exactly 6pm and transitions the market to `open`. Same thing for closing. Using the newer `ScheduleV2` type was important because the older EventBridge Rules don't support timezones properly.

**Amazon S3** hosts the built frontend files. Nothing special here — it's a private bucket, no public access, and only CloudFront can read from it using an Origin Access Control policy. It's the cheapest and simplest way to host a static site.

**Amazon CloudFront** serves the frontend over HTTPS and handles routing. One thing we ran into was that S3 returns a 403 (not a 404) for paths it doesn't know about, which caused React Router routes like `/leaderboard` to show "Access Denied" when you navigated directly. The fix was adding custom error responses for both 403 and 404 to redirect to `index.html`.

---

## Design Decisions

**Constant-sum pricing model.** We used a simple constant-sum model for YES/NO pricing rather than a more sophisticated LMSR (Logarithmic Market Scoring Rule). The way it works is: YES price + NO price = 100¢, and each bet shifts the price proportionally to the bet size divided by total volume. We seeded every market with 100 units of phantom volume so the first bet doesn't move the price dramatically. This was the right call for a class project — LMSR is more theoretically correct but much harder to reason about and explain.

**Serverless-only.** We deliberately avoided anything that required managing a server. No EC2, no RDS, no Redis. This was partly a practical choice (none of us wanted to deal with SSH keys and uptime during finals week) and partly the point of the project — to actually use cloud-native managed services the way they're intended. The tradeoff is cold starts on Lambda, but for a class betting app that's perfectly acceptable.

**Single SAM template.** All 9 services and 15 Lambda functions are declared in one `template.yaml` file. This made it easy to track everything in version control and deploy from scratch in one command. The downside is the file got long, but it was worth it for the simplicity of deployment.

**TypeScript everywhere.** Both the frontend and all 15 Lambda functions are TypeScript. This let us share type definitions between the two without any extra tooling, and caught a number of bugs at compile time that would have been annoying runtime errors in a late-night debugging session.

---

## What We Learned

The biggest thing we learned is that real-time on AWS is doable but has a lot of sharp edges. The WebSocket JWT issue (browsers can't send auth headers) wasn't obvious from the documentation and took a while to figure out. DynamoDB Streams behavior at startup also bit us — if you use `LATEST` instead of `TRIM_HORIZON`, you miss events that happened while the event source mapping was being created.

We also got a real appreciation for how much the SAM framework abstracts away. Defining a Lambda function with an HTTP API event source in SAM is maybe 10 lines of YAML; doing the same thing manually in CloudFormation would be 5x that. The tradeoff is that SAM has its own quirks and not everything is supported natively (WebSocket APIs need raw CloudFormation resources, for example).

On the product side, the phantom liquidity seed was a late discovery. Without seeding the market volume to 100 on creation, the first bet of $10 would move a market from 50¢ to 99¢, which makes no sense for something that's genuinely uncertain. Adding the seed made the pricing feel real.

If we were to do this again, we'd probably set up a proper dev/staging environment earlier. We were deploying directly to production for most of the project, which worked but made it stressful to push experimental changes. We'd also look into LMSR pricing from the start — the constant-sum model is a simplification that limits the expressiveness of the markets.

---

## How It Fits the Course

This project ended up being a pretty direct application of what we covered in CS 1660. We touched on managed compute (Lambda), managed storage (DynamoDB, S3), managed auth (Cognito), event-driven architecture (Streams, EventBridge), CDN and edge delivery (CloudFront), and infrastructure as code (SAM/CloudFormation). The real-time component pushed us to think about how different AWS services connect to each other, which is exactly the kind of systems thinking the course was building toward.

The fact that it's actually running and being used by classmates made it more interesting to build than a hypothetical project. When you know your friends are placing real bets on it, you care a lot more about whether the balance deduction is atomic.
