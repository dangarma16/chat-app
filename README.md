# Professional Voice Chat App

A modern, professional voice chat application with screen sharing capabilities built with Node.js, Socket.IO, and WebRTC.

## Features

- 🎤 **Voice Chat**: High-quality voice communication
- 📺 **Screen Sharing**: Share your screen with audio
- 🎛️ **Volume Controls**: Individual volume control for microphone and speakers
- 🔇 **Mute Controls**: Mute microphone and speakers independently
- 💬 **Text Chat**: Real-time text messaging
- 🎨 **Professional UI**: Modern, business-appropriate interface
- 📱 **Responsive Design**: Works on desktop and mobile
- 🔒 **Secure**: Peer-to-peer connections with WebRTC

## Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd professional-voice-chat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

## Deployment Options

### Option 1: Deploy to Vercel (Recommended)

1. **Create a GitHub repository** and push your code
2. **Go to [Vercel](https://vercel.com)** and sign up
3. **Import your GitHub repository**
4. **Configure deployment**:
   - Build Command: `npm run build`
   - Output Directory: `public`
   - Install Command: `npm install`
5. **Deploy** - You'll get a permanent URL like `https://your-app.vercel.app`

### Option 2: Deploy to Railway

1. **Go to [Railway](https://railway.app)**
2. **Connect your GitHub repository**
3. **Deploy automatically** - Railway will detect it's a Node.js app
4. **Get your permanent URL**

### Option 3: Deploy to Render

1. **Go to [Render](https://render.com)**
2. **Create a new Web Service**
3. **Connect your GitHub repository**
4. **Configure**:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. **Deploy** and get your permanent URL

### Option 4: Deploy to Heroku

1. **Install Heroku CLI**
2. **Create Heroku app**:
   ```bash
   heroku create your-app-name
   ```
3. **Deploy**:
   ```bash
   git push heroku main
   ```

## Environment Variables

For production deployment, you may want to set these environment variables:

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (production/development)

## Usage

1. **Join the chat** with a username
2. **Start voice chat** using the controls on the left
3. **Share your screen** with the "Share Screen" button
4. **Adjust volume** using the sliders
5. **Mute/unmute** using the buttons
6. **Use full-screen mode** for immersive viewing

## Technical Details

- **Backend**: Node.js with Express and Socket.IO
- **Frontend**: Vanilla JavaScript with WebRTC
- **Real-time**: Socket.IO for signaling
- **Voice/Video**: WebRTC for peer-to-peer communication
- **Styling**: CSS with modern design principles

## Browser Support

- Chrome 66+
- Firefox 60+
- Safari 11+
- Edge 79+

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and questions, please open an issue on GitHub. 