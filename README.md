## Inter-View

Inter-View is a small coding interview app built with Next.js.

## Required environment variables

Set `INTERVIEWER_PASSWORD` before running or deploying the app. The interviewer
console, session creation/list endpoints, and report views require this shared
password. Candidate review links stay accessible without login.

## Getting Started

First, install dependencies and run the development server:

```bash
pnpm install
INTERVIEWER_PASSWORD=change-me pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the
shared interviewer password.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
