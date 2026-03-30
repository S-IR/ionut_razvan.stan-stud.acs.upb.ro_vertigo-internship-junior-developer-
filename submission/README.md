# Submission
https://github.com/S-IR/ionut_razvan.stan-stud.acs.upb.ro_vertigo-internship-junior-developer-
## Short Description
I used the same tech stack (frontend and backend). I just built ontop of it.
The Quick Start is identical to the one provided at the beginning. The only .env variable that I added is server side ENV="DEV" to use for asserts plus for creating users with admin role in development mode automatically. The server still works without it

I went with a minimalistic casual site design. I thought it lends well to impulsive betting decisions

I made sure that every necesarry page updates on creating a new market, adding bets, closing the market or user updates
I decided to use router.invalidate() for most refetching of stale data. It's less bug prone than trying to manually update and valiate each individual data piece. Since I do pagination the cost should be minimal.

The API.ts will trigger a loading screen for every API call that takes longer than 200ms on __root.tsx component. I avoided having loading logic on every page. Plus it will throw special errors to include the status code in case of different sort of errors.
I went with event source API since is more fitting than something like websockets for sending update events. The events themselves do not deliver data but simply inform that a change has occcurred
I made all publicly accessible API routes have a /public prefix for security sake
I removed the handlers.ts file and just inlined the functions for each handle for type safety of inputs.
I changed the JWT authentication to a cookie based one. It's more robust to xss attacks.
I don't remember adding any extra special dependencies besides the chart dependency for /markets/:id frontend page
The most difficult parts was handling the event source and updating the UI in real time with changes

I added --target bun to the buil command on server for it to compile. you can change it to node if need be
I did create the API route.
I tried not to add anything extra that was not required.

I tested on Windows 11 and Arch Linux (cachyOS) and it worked fine to run, lint and build
My normal day to day email is stitrzv@gmail.com and I do prefer if you would use that over my university's ionut_razvan.stan-stud.acs.upb.ro

## Images or Video Demo
https://drive.google.com/file/d/1ZEaaOBXmUKNzbVTXEq2pFvHJDPOq2lUo/view?usp=sharing
