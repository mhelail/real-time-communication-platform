\# Real-Time Communication Platform



This is a real-time chat and voice call application built with Node.js, Socket.IO and WebRTC.  

The goal of the project is to let users create accounts, chat in private or in groups, and make basic voice calls through the browser.



\## Features



\- User registration and login with JWT-based authentication

\- Real-time one-to-one and group messaging over Socket.IO

\- Conversation rooms to separate different chats

\- Simple inactivity handling and basic status updates

\- Minimal web UI for login, registration and chatting



\## Tech Stack



\- \*\*Backend:\*\* Node.js, Express, Socket.IO  

\- \*\*Realtime:\*\* Socket.IO, WebRTC (for voice calls)  

\- \*\*Database:\*\* MongoDB with Mongoose  

\- \*\*Frontend:\*\* Plain HTML, CSS and JavaScript  

\- \*\*Security:\*\* JWT authentication, HTTPS (SSL support)



\## Project Structure



\- `app.js` – main entry point (Express app + Socket.IO setup)

\- `controllers/` – logic for auth, conversations, groups, inactivity

\- `routes/` – REST API endpoints (auth, messages, conversations, groups)

\- `models/` – Mongoose models (User, Message, Group, Conversation)

\- `socket.io/` – Socket.IO events for real-time messaging

\- `config/` – configuration (e.g. database connection)

\- `chat.html`, `login.html`, `register.html`, `entrance.html` – main frontend pages



\## Getting Started



1\. Clone the repository:

&nbsp;  ```bash

&nbsp;  git clone https://github.com/mhelail/real-time-communication-platform.git

&nbsp;  cd real-time-communication-platform

2. Install dependencies:



&nbsp;  npm install





3\. Create a .env file in the project root with at least:



&nbsp;  PORT=3000

&nbsp;  MONGODB\_URI=your\_mongodb\_uri\_here

&nbsp;  JWT\_SECRET=your\_jwt\_secret\_here





4\. Start the server:



&nbsp;  npm start  or:  node app.js





5\. Open the app in your browser:



&nbsp;  https://localhost:3000

