console.log('Script loading...');

// Connect to the server
const socket = io();

// For development with ngrok, you can manually update this URL
// const socket = io('https://your-ngrok-url.ngrok-free.app');

// Basic variables
let localStream = null;
let peerConnections = {};
let isVoiceActive = false;
let currentUsername = '';
let microphoneGainNode = null;
let audioContext = null;

// Screen sharing variables
let screenStream = null;
let isScreenSharing = false;
let originalLocalStream = null;

// Volume settings
let microphoneVolume = 1.0;
let incomingVolume = 1.0;
let isMicrophoneMuted = false;
let isSpeakerMuted = false;

// Mute status tracking for all users
let userMuteStatus = {};

// Connection status
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Simple WebRTC config
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Socket connection events
socket.on('connect', () => {
    console.log('Connected to server');
    isConnected = true;
    reconnectAttempts = 0;
    updateConnectionStatus();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    isConnected = false;
    updateConnectionStatus();
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
        setTimeout(() => {
            socket.connect();
        }, 1000 * reconnectAttempts); // Exponential backoff
    } else {
        console.log('Max reconnect attempts reached. Please refresh the page.');
        addMessage('⚠️ Bağlantı kesildi. Lütfen sayfayı yenileyin.', 'red');
    }
});

// Update connection status display
function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        if (isConnected) {
            statusElement.innerHTML = '🟢 Bağlandı';
            statusElement.style.color = '#43b581';
        } else {
            statusElement.innerHTML = '🔴 Bağlantı Kesildi';
            statusElement.style.color = '#f04747';
        }
    }
}

// Auto-resize textarea
function autoResizeTextarea() {
    const textarea = document.getElementById('messageInput');
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
}

// Join chat function
function join() {
    const username = document.getElementById('username').value.trim();
    if (username === '') {
        addMessage('⚠️ Lütfen bir kullanıcı adı girin', 'orange', 'system');
        return;
    }
    
    currentUsername = username;
    socket.emit('join', username);
    document.getElementById('login').style.display = 'none';
    document.getElementById('chat').style.display = 'flex';
    
    // Add welcome message
    addMessage(`🎉 Sohbete hoş geldin, ${username}!`, 'green', 'system');
    addMessage('💡 Sol taraftaki ses kontrollerini kullanarak sesli sohbete başlayın', 'blue', 'system');
}

// Send text message
function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (message !== '') {
        socket.emit('message', message);
        input.value = '';
        autoResizeTextarea(); // Reset textarea height
    }
}

// Update microphone volume
function updateMicrophoneVolume(value) {
    microphoneVolume = value / 100;
    console.log('Updating microphone volume to:', microphoneVolume);
    
    if (microphoneGainNode) {
        // Only update gain if not muted
        if (!isMicrophoneMuted) {
            microphoneGainNode.gain.value = microphoneVolume;
            console.log('Microphone gain updated to:', microphoneVolume);
        } else {
            console.log('Microphone is muted, not updating gain (will apply when unmuted)');
        }
    } else {
        console.log('Warning: microphoneGainNode not available');
    }
    
    document.getElementById('micVolumeDisplay').textContent = value + '%';
    
    // Test the current state
    testMuting();
}

// Update incoming audio volume
function updateIncomingVolume(value) {
    incomingVolume = value / 100;
    // Update all existing audio elements
    document.querySelectorAll('audio').forEach(audio => {
        if (!isSpeakerMuted) {
            audio.volume = incomingVolume;
        }
    });
    document.getElementById('incomingVolumeDisplay').textContent = value + '%';
}

// Test function to debug muting
function testMuting() {
    console.log('=== MUTING DEBUG INFO ===');
    console.log('isMicrophoneMuted:', isMicrophoneMuted);
    console.log('microphoneVolume:', microphoneVolume);
    console.log('microphoneGainNode exists:', !!microphoneGainNode);
    if (microphoneGainNode) {
        console.log('Current gain value:', microphoneGainNode.gain.value);
        console.log('Gain node connected:', microphoneGainNode.numberOfInputs > 0);
    }
    console.log('localStream exists:', !!localStream);
    if (localStream) {
        console.log('Local stream tracks:', localStream.getTracks().length);
        localStream.getTracks().forEach((track, index) => {
            console.log(`Track ${index}:`, track.kind, track.enabled, track.readyState);
        });
    }
    console.log('========================');
}

// Toggle microphone mute
function toggleMicrophoneMute() {
    isMicrophoneMuted = !isMicrophoneMuted;
    
    console.log('Toggling microphone mute:', isMicrophoneMuted);
    
    if (microphoneGainNode) {
        if (isMicrophoneMuted) {
            microphoneGainNode.gain.value = 0;
            console.log('Microphone muted - gain set to 0');
        } else {
            microphoneGainNode.gain.value = microphoneVolume;
            console.log('Microphone unmuted - gain set to:', microphoneVolume);
        }
    } else {
        console.log('Warning: microphoneGainNode not available');
    }
    
    // Test the muting
    testMuting();
    
    const muteButton = document.getElementById('micMuteButton');
    if (isMicrophoneMuted) {
        muteButton.textContent = 'Mikrofonu Aç';
        muteButton.style.backgroundColor = '#dc3545';
        addMessage('Mikrofonunuz kapalı - diğerleri sizin sesi duyamaz', 'orange', 'mute');
    } else {
        muteButton.textContent = 'Mikrofonu Kapat';
        muteButton.style.backgroundColor = '#43b581';
        addMessage('Mikrofonunuz açık - diğerleri sizin sesi duyabilir', 'green', 'mute');
    }
    
    // Emit mute status to other users
    socket.emit('mute_status', {
        type: 'microphone',
        muted: isMicrophoneMuted
    });
    
    // Update local tracking
    if (!userMuteStatus[currentUsername]) {
        userMuteStatus[currentUsername] = {};
    }
    userMuteStatus[currentUsername].microphone = isMicrophoneMuted;
    
    // Update the users list display to show the new mute status
    updateUsersListDisplay();
}

// Toggle speaker mute
function toggleSpeakerMute() {
    isSpeakerMuted = !isSpeakerMuted;
    
    // Update all existing audio elements
    document.querySelectorAll('audio').forEach(audio => {
        if (isSpeakerMuted) {
            audio.volume = 0;
        } else {
            audio.volume = incomingVolume;
        }
    });
    
    const muteButton = document.getElementById('speakerMuteButton');
    if (isSpeakerMuted) {
        muteButton.textContent = 'Konuşmacıyı Aç';
        muteButton.style.backgroundColor = '#dc3545';
        addMessage('Konuşmacınız kapalı - diğerleri sizin sesi duyamaz', 'orange', 'mute');
    } else {
        muteButton.textContent = 'Konuşmacıyı Kapat';
        muteButton.style.backgroundColor = '#43b581';
        addMessage('Konuşmacınız açık - diğerleri sizin sesi duyabilir', 'green', 'mute');
    }
    
    // Emit mute status to other users
    socket.emit('mute_status', {
        type: 'speaker',
        muted: isSpeakerMuted
    });
    
    // Update local tracking
    if (!userMuteStatus[currentUsername]) {
        userMuteStatus[currentUsername] = {};
    }
    userMuteStatus[currentUsername].speaker = isSpeakerMuted;
    
    // Update the users list display to show the new mute status
    updateUsersListDisplay();
}

// Start voice chat
async function startVoice() {
    try {
        console.log('Starting voice chat...');
        
        // Get microphone access
        const originalStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true 
        });
        
        console.log('Microphone access granted');
        
        // Set up audio processing for microphone volume control
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(originalStream);
        microphoneGainNode = audioContext.createGain();
        
        // Set initial volume
        microphoneGainNode.gain.value = isMicrophoneMuted ? 0 : microphoneVolume;
        
        // Create a new stream with volume control
        const destination = audioContext.createMediaStreamDestination();
        source.connect(microphoneGainNode);
        microphoneGainNode.connect(destination);
        
        // Store the processed stream for WebRTC (this is what others will hear)
        localStream = destination.stream;
        
        console.log('Audio processing set up - gain node connected');
        console.log('Initial mute state:', isMicrophoneMuted);
        console.log('Initial volume:', microphoneVolume);
        
        // Update UI
        document.getElementById('startVoice').style.display = 'none';
        document.getElementById('stopVoice').style.display = 'block';
        document.getElementById('voiceStatus').textContent = 'Ses: Aktif';
        document.getElementById('voiceStatus').style.color = '#43b581';
        
        // Show volume controls
        document.getElementById('volumeControls').style.display = 'block';
        
        isVoiceActive = true;
        
        // Notify others
        socket.emit('voice_started', currentUsername);
        
        // Show success message
        addMessage('Sesli sohbet başladı! Artık diğer kullanıcılarla konuşabilirsiniz.', 'green', 'voice');
        
    } catch (error) {
        console.error('Error starting voice:', error);
        addMessage('Mikrofon erişimi yapılamadı: ' + error.message, 'red', 'system');
    }
}

// Stop voice chat
function stopVoice() {
    console.log('Stopping voice chat...');
    
    // Stop screen sharing if active
    if (isScreenSharing) {
        stopScreenShare();
    }
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Clean up screen sharing variables
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    originalLocalStream = null;
    
    // Close audio context
    if (audioContext) {
        audioContext.close();
        audioContext = null;
        microphoneGainNode = null;
    }
    
    // Close all peer connections
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    
    // Remove audio elements
    document.querySelectorAll('audio').forEach(audio => audio.remove());
    
    // Update UI
    document.getElementById('startVoice').style.display = 'block';
    document.getElementById('stopVoice').style.display = 'none';
    document.getElementById('voiceStatus').textContent = 'Ses: Kapalı';
    document.getElementById('voiceStatus').style.color = '#666';
    
    // Hide volume controls
    document.getElementById('volumeControls').style.display = 'none';
    
    // Reset mute states
    isMicrophoneMuted = false;
    isSpeakerMuted = false;
    
    // Clear mute status for current user
    if (userMuteStatus[currentUsername]) {
        userMuteStatus[currentUsername] = {};
    }
    
    isVoiceActive = false;
    
    // Notify others
    socket.emit('voice_stopped', currentUsername);
    
    addMessage('Sesli sohbet durduruldu. Artık ses akışınız yok.', 'red', 'voice');
}

// Toggle screen sharing
async function toggleScreenShare() {
    try {
        if (!isScreenSharing) {
            // Start screen sharing
            console.log('Starting screen share...');
            
            // Get screen capture with audio
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: true // Include audio from screen share
            });
            
            console.log('Screen capture started with audio');
            
            // Store original stream if this is the first time
            if (!originalLocalStream && localStream) {
                originalLocalStream = localStream;
            }
            
            // Create new stream with screen video and audio
            if (localStream) {
                const originalAudioTracks = localStream.getAudioTracks();
                const screenVideoTracks = screenStream.getVideoTracks();
                const screenAudioTracks = screenStream.getAudioTracks();
                
                // Create new stream with screen video and screen audio (prioritize screen audio)
                const newStream = new MediaStream();
                
                // Add screen video track
                screenVideoTracks.forEach(track => newStream.addTrack(track));
                
                // Add screen audio track if available, otherwise use original audio
                if (screenAudioTracks.length > 0) {
                    screenAudioTracks.forEach(track => newStream.addTrack(track));
                    console.log('Using screen share audio');
                } else {
                    originalAudioTracks.forEach(track => newStream.addTrack(track));
                    console.log('Using original audio (no screen audio)');
                }
                
                // Update local stream
                localStream = newStream;
                
                // Show screen share in local viewer
                showScreenShare(screenStream, currentUsername);
                
                // Update all peer connections with new stream
                Object.values(peerConnections).forEach(pc => {
                    const senders = pc.getSenders();
                    senders.forEach(sender => {
                        if (sender.track && sender.track.kind === 'video') {
                            sender.replaceTrack(screenVideoTracks[0]);
                        }
                        if (sender.track && sender.track.kind === 'audio') {
                            if (screenAudioTracks.length > 0) {
                                sender.replaceTrack(screenAudioTracks[0]);
                            }
                        }
                    });
                });
            }
            
            isScreenSharing = true;
            
            // Update button
            const button = document.getElementById('screenShareButton');
            button.textContent = 'Ekranı Durdur';
            button.style.backgroundColor = '#dc3545';
            
            addMessage('Ekran paylaşımı başladı', 'green', 'system');
            
            // Notify other users
            socket.emit('screen_share_update', {
                sharing: true
            });
            
            // Handle screen share stop
            screenStream.getVideoTracks()[0].onended = () => {
                console.log('Screen share ended by user');
                stopScreenShare();
            };
            
        } else {
            // Stop screen sharing
            stopScreenShare();
        }
        
    } catch (error) {
        console.error('Error with screen sharing:', error);
        addMessage('Ekran paylaşımı başlatılamadı: ' + error.message, 'red', 'system');
    }
}

// Stop screen sharing
function stopScreenShare() {
    console.log('Stopping screen share...');
    
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    
    // Hide screen share from local viewer
    hideScreenShare();
    
    // Restore original stream if available
    if (originalLocalStream) {
        localStream = originalLocalStream;
        
        // Update all peer connections with original stream
        Object.values(peerConnections).forEach(pc => {
            const senders = pc.getSenders();
            senders.forEach(sender => {
                if (sender.track && sender.track.kind === 'video') {
                    const originalVideoTrack = originalLocalStream.getVideoTracks()[0];
                    if (originalVideoTrack) {
                        sender.replaceTrack(originalVideoTrack);
                    }
                }
            });
        });
    }
    
    isScreenSharing = false;
    
    // Update button
    const button = document.getElementById('screenShareButton');
    button.textContent = 'Ekranı Paylaş';
    button.style.backgroundColor = '#3b82f6';
    
    addMessage('Ekran paylaşımı durduruldu', 'orange', 'system');
    
    // Notify other users
    socket.emit('screen_share_update', {
        sharing: false
    });
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isScreenSharing) {
        console.log('Page hidden, stopping screen share');
        stopScreenShare();
    }
});

// Handle page focus changes
window.addEventListener('focus', () => {
    if (isScreenSharing && screenStream) {
        // Check if screen stream is still active
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack && videoTrack.readyState === 'ended') {
            console.log('Screen stream ended, cleaning up');
            stopScreenShare();
        }
    }
});

// Create peer connection
function createPeerConnection(targetUsername) {
    console.log('Creating connection with:', targetUsername);
    
    // Check if connection already exists
    if (peerConnections[targetUsername]) {
        console.log('Connection already exists with:', targetUsername);
        return peerConnections[targetUsername];
    }
    
    const pc = new RTCPeerConnection(rtcConfig);
    
    // Add local stream tracks (both audio and video)
    if (localStream && localStream.getTracks) {
        localStream.getTracks().forEach(track => {
            console.log('Adding track to peer connection:', track.kind, track.enabled);
            pc.addTrack(track, localStream);
        });
    }
    
    // Handle incoming audio and video
    pc.ontrack = (event) => {
        console.log('Received track from:', targetUsername, event.track.kind);
        
        if (event.track.kind === 'audio') {
            // Handle incoming audio
            if (event.streams && event.streams[0]) {
                const audio = document.createElement('audio');
                audio.srcObject = event.streams[0];
                audio.autoplay = true;
                audio.id = `audio-${targetUsername}`;
                // Set volume based on mute state
                audio.volume = isSpeakerMuted ? 0 : incomingVolume;
                document.body.appendChild(audio);
                
                addMessage(`${targetUsername} sesi duyuyorsunuz`, 'blue', 'voice');
            }
        } else if (event.track.kind === 'video') {
            // Handle incoming video (screen share)
            console.log('Received video track from:', targetUsername);
            
            // Create a new MediaStream with just the video track for display
            const videoStream = new MediaStream([event.track]);
            
            // Show the screen share in the center viewer
            showScreenShare(videoStream, targetUsername);
            
            // Store the stream for later cleanup
            if (!peerConnections[targetUsername].videoStream) {
                peerConnections[targetUsername].videoStream = videoStream;
            }
            
            // Add message that screen sharing started
            addMessage(`${targetUsername} ekranını paylaşıyor`, 'blue', 'system');
        }
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
        console.log('Connection state changed:', targetUsername, pc.connectionState);
        if (pc.connectionState === 'connected') {
            addMessage(`✅ ${targetUsername} ile bağlantı kuruldu`, 'green', 'system');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            addMessage(`❌ ${targetUsername} ile bağlantı kurulamadı`, 'red', 'system');
        }
    };
    
    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', targetUsername, pc.iceConnectionState);
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('Sending ICE candidate to:', targetUsername);
            socket.emit('ice_candidate', {
                candidate: event.candidate,
                target: targetUsername
            });
        }
    };
    
    // Store connection
    peerConnections[targetUsername] = pc;
    
    // Create and send offer
    pc.createOffer()
        .then(offer => {
            console.log('Created offer for:', targetUsername);
            return pc.setLocalDescription(offer);
        })
        .then(() => {
            console.log('Sending offer to:', targetUsername);
            socket.emit('offer', {
                offer: pc.localDescription,
                target: targetUsername
            });
        })
        .catch(error => {
            console.error('Error creating offer for:', targetUsername, error);
            addMessage(`❌ ${targetUsername} ile bağlantı kurulamadı`, 'red', 'system');
        });
    
    return pc;
}

// Helper function to add messages
function addMessage(text, color = 'black', type = 'message') {
    const messagesList = document.getElementById('messagesList');
    const messageDiv = document.createElement('div');
    
    // Add timestamp
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Format message based on type
    let messageClass = '';
    if (type === 'system') messageClass = 'message-system';
    else if (type === 'voice') messageClass = 'message-voice';
    else if (type === 'mute') messageClass = 'message-mute';
    else if (type === 'join') messageClass = 'message-join';
    else if (type === 'leave') messageClass = 'message-leave';
    
    messageDiv.innerHTML = `
        <div class="${messageClass}">
            <span style="color: #72767d; font-size: 12px; margin-right: 8px;">${timeString}</span>
            ${text}
        </div>
    `;
    
    if (color !== 'black') {
        messageDiv.style.color = color;
    }
    
    messageDiv.classList.add('fade-in');
    messagesList.appendChild(messageDiv);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Update users list display with mute status indicators
function updateUsersListDisplay() {
    const usersList = document.getElementById('usersList');
    if (!usersList || !currentUsername) return; // Don't update if user hasn't joined
    
    // Request the current users list from the server to update display
    socket.emit('request_users_list');
}

// Get mute status indicator HTML
function getMuteStatusIndicator(username) {
    const status = userMuteStatus[username];
    if (!status) return '';
    
    let indicators = '';
    if (status.microphone) {
        indicators += ' <span title="Mikrofon kapalı" style="color: #dc3545; font-size: 12px;">🔇</span>';
    }
    if (status.speaker) {
        indicators += ' <span title="Konuşmacı kapalı" style="color: #dc3545; font-size: 12px;">🔇</span>';
    }
    
    return indicators;
}

// Toggle chat size (minimize/maximize)
function toggleChatSize() {
    const messages = document.getElementById('messages');
    const maximizeButton = document.getElementById('maximizeChatButton');
    
    console.log('Toggling chat size');
    
    if (messages.classList.contains('chat-minimized')) {
        // Maximize chat
        messages.classList.remove('chat-minimized');
        messages.classList.add('chat-maximized');
        maximizeButton.textContent = '⬜';
        maximizeButton.title = 'Sohbeti Küçült';
        console.log('Chat maximized');
    } else {
        // Minimize chat
        messages.classList.remove('chat-maximized');
        messages.classList.add('chat-minimized');
        maximizeButton.textContent = '⬜';
        maximizeButton.title = 'Sohbeti Büyüt';
        console.log('Chat minimized');
    }
}

// Toggle full screen mode
function toggleFullScreen() {
    const chat = document.getElementById('chat');
    const fullScreenButton = document.getElementById('fullScreenButton');
    
    console.log('Toggling full screen mode');
    
    if (chat.classList.contains('fullscreen-mode')) {
        // Exit full screen
        console.log('Exiting full screen mode');
        chat.classList.remove('fullscreen-mode');
        fullScreenButton.textContent = '⛶';
        fullScreenButton.title = 'Tam Ekran';
        document.body.style.overflow = 'auto';
        
        // Ensure the button is visible
        fullScreenButton.style.display = 'block';
    } else {
        // Enter full screen
        console.log('Entering full screen mode');
        chat.classList.add('fullscreen-mode');
        fullScreenButton.textContent = '⛶';
        fullScreenButton.title = 'Tam Ekranı Kapat';
        document.body.style.overflow = 'hidden';
        
        // Ensure the button is visible
        fullScreenButton.style.display = 'block';
    }
}

// Add keyboard shortcut for full screen (ESC key)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const chat = document.getElementById('chat');
        if (chat.classList.contains('fullscreen-mode')) {
            toggleFullScreen();
        }
    }
});

// Show screen share video
function showScreenShare(videoStream, username) {
    const screenVideo = document.getElementById('screenVideo');
    const noScreenMessage = document.getElementById('noScreenMessage');
    const fullScreenButton = document.getElementById('fullScreenButton');
    
    console.log('Showing screen share for:', username);
    
    if (videoStream && videoStream.getVideoTracks().length > 0) {
        screenVideo.srcObject = videoStream;
        screenVideo.style.display = 'block';
        noScreenMessage.style.display = 'none';
        fullScreenButton.style.display = 'block';
        
        // Add right-click context menu for volume control
        screenVideo.oncontextmenu = (e) => {
            e.preventDefault();
            showVolumeContextMenu(e, username);
        };
        
        // Store the username for this screen share
        screenVideo.dataset.sharingUser = username;
        
        console.log('Screen share video displayed successfully');
    } else {
        console.log('No video tracks in stream, cannot display screen share');
    }
}

// Hide screen share video
function hideScreenShare() {
    const screenVideo = document.getElementById('screenVideo');
    const noScreenMessage = document.getElementById('noScreenMessage');
    const fullScreenButton = document.getElementById('fullScreenButton');
    
    console.log('Hiding screen share');
    
    // Clear the video source and stop all tracks
    if (screenVideo.srcObject) {
        screenVideo.srcObject.getTracks().forEach(track => {
            console.log('Stopping track:', track.kind, track.readyState);
            track.stop();
        });
        screenVideo.srcObject = null;
    }
    
    // Completely reset the video element
    screenVideo.pause();
    screenVideo.currentTime = 0;
    screenVideo.load(); // This forces a complete reset
    
    // Reset video element display and data
    screenVideo.style.display = 'none';
    screenVideo.dataset.sharingUser = '';
    
    // Show no screen message
    noScreenMessage.style.display = 'block';
    
    // Hide full screen button if not in full screen mode
    if (!document.getElementById('chat').classList.contains('fullscreen-mode')) {
        fullScreenButton.style.display = 'none';
    }
    
    console.log('Screen share hidden and video completely reset');
}

// Show volume context menu for screen share
function showVolumeContextMenu(event, username) {
    // Remove existing context menu
    const existingMenu = document.getElementById('volumeContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.id = 'volumeContextMenu';
    contextMenu.style.cssText = `
        position: fixed;
        top: ${event.clientY}px;
        left: ${event.clientX}px;
        background: #1a1f2e;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 12px;
        z-index: 10000;
        min-width: 200px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;
    
    contextMenu.innerHTML = `
        <div style="color: #e2e8f0; font-size: 14px; margin-bottom: 10px; font-weight: 500;">
            ${username}'in Ekranının Ses Seviyesi
        </div>
        <div style="margin-bottom: 8px;">
            <input type="range" id="screenVolumeSlider" min="0" max="100" value="100" 
                   style="width: 100%; height: 6px;" oninput="updateScreenVolume(this.value)">
        </div>
        <div style="color: #94a3b8; font-size: 12px; text-align: center;">
            Ses: <span id="screenVolumeDisplay">100%</span>
        </div>
    `;
    
    document.body.appendChild(contextMenu);
    
    // Close context menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!contextMenu.contains(e.target)) {
            contextMenu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
    
    // Set initial volume
    const volumeSlider = document.getElementById('screenVolumeSlider');
    const volumeDisplay = document.getElementById('screenVolumeDisplay');
    const currentVolume = getScreenVolume(username) || 100;
    volumeSlider.value = currentVolume;
    volumeDisplay.textContent = currentVolume + '%';
}

// Update screen share volume
function updateScreenVolume(value) {
    const volumeDisplay = document.getElementById('screenVolumeDisplay');
    volumeDisplay.textContent = value + '%';
    
    const volume = value / 100;
    
    // Find the screen video and update its volume
    const screenVideo = document.getElementById('screenVideo');
    if (screenVideo && screenVideo.srcObject) {
        // For screen sharing, we need to find the audio track and adjust its volume
        const audioTracks = screenVideo.srcObject.getAudioTracks();
        if (audioTracks.length > 0) {
            // Create a new MediaStream with adjusted volume
            // Note: This is a simplified approach - in a real implementation you might need more sophisticated audio processing
            console.log('Screen share volume set to:', volume);
            
            // Update the volume of any audio elements that might be playing screen share audio
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
                if (audio.id.includes('screen') || audio.srcObject === screenVideo.srcObject) {
                    audio.volume = volume;
                }
            });
        }
    }
    
    // Store the volume setting for this user
    const username = screenVideo ? screenVideo.dataset.sharingUser : '';
    if (username) {
        if (!window.screenShareVolumes) {
            window.screenShareVolumes = {};
        }
        window.screenShareVolumes[username] = volume;
    }
}

// Get screen volume for a specific user
function getScreenVolume(username) {
    if (window.screenShareVolumes && window.screenShareVolumes[username]) {
        return window.screenShareVolumes[username] * 100;
    }
    return 100; // Default volume
}

// Enter key for sending messages
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea on input
document.getElementById('messageInput').addEventListener('input', autoResizeTextarea);

// Initialize connection status
document.addEventListener('DOMContentLoaded', () => {
    updateConnectionStatus();
});

// Socket event handlers
socket.on('message', (data) => {
    if (currentUsername) { // Only show messages if user has joined
        addMessage(`<strong>${data.username}:</strong> ${data.message}`, 'black', 'message');
    }
});

socket.on('user joined', (username) => {
    if (currentUsername) { // Only show join messages if user has joined
        addMessage(`${username} sohbete katıldı`, 'green', 'join');
        
        // Create voice connection if we're in voice chat
        if (isVoiceActive && username !== currentUsername) {
            createPeerConnection(username);
        }
    }
});

socket.on('user left', (username) => {
    if (currentUsername) { // Only show leave messages if user has joined
        addMessage(`${username} sohbetten ayrıldı`, 'red', 'leave');
        
        // Clean up connection
        if (peerConnections[username]) {
            // Clean up video stream if exists
            if (peerConnections[username].videoStream) {
                peerConnections[username].videoStream.getTracks().forEach(track => track.stop());
                delete peerConnections[username].videoStream;
            }
            
            peerConnections[username].close();
            delete peerConnections[username];
        }
        
        // Remove audio
        const audio = document.getElementById(`audio-${username}`);
        if (audio) audio.remove();
        
        // Hide screen share if this user was sharing
        const screenVideo = document.getElementById('screenVideo');
        if (screenVideo && screenVideo.dataset.sharingUser === username) {
            hideScreenShare();
        }
    }
});

socket.on('users list', (users) => {
    if (currentUsername) { // Only update users list if user has joined
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.innerHTML = user + getMuteStatusIndicator(user);
            usersList.appendChild(li);
        });
    }
});

// Voice chat events
socket.on('voice_started', (username) => {
    if (currentUsername && username !== currentUsername) { // Only process if user has joined
        addMessage(`${username} sesli sohbete başladı`, 'blue', 'voice');
        
        if (isVoiceActive) {
            createPeerConnection(username);
        }
    }
});

socket.on('voice_stopped', (username) => {
    if (currentUsername && username !== currentUsername) { // Only process if user has joined
        addMessage(`${username} sesli sohbeti durdurdu`, 'orange', 'voice');
        
        // Clean up
        if (peerConnections[username]) {
            // Clean up video stream if exists
            if (peerConnections[username].videoStream) {
                peerConnections[username].videoStream.getTracks().forEach(track => track.stop());
                delete peerConnections[username].videoStream;
            }
            
            peerConnections[username].close();
            delete peerConnections[username];
        }
        
        const audio = document.getElementById(`audio-${username}`);
        if (audio) audio.remove();
        
        // Hide screen share if this user was sharing
        const screenVideo = document.getElementById('screenVideo');
        if (screenVideo && screenVideo.dataset.sharingUser === username) {
            hideScreenShare();
        }
    }
});

// WebRTC signaling
socket.on('offer', async (data) => {
    if (!currentUsername || data.from === currentUsername) return; // Only process if user has joined
    
    console.log('Received offer from:', data.from);
    
    // Create connection if it doesn't exist
    if (!peerConnections[data.from]) {
        createPeerConnection(data.from);
    }
    
    const pc = peerConnections[data.from];
    
    try {
        console.log('Setting remote description for:', data.from);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        console.log('Creating answer for:', data.from);
        const answer = await pc.createAnswer();
        
        console.log('Setting local description for:', data.from);
        await pc.setLocalDescription(answer);
        
        console.log('Sending answer to:', data.from);
        socket.emit('answer', {
            answer: answer,
            target: data.from
        });
        
        addMessage(`📡 ${data.from}'in sesli aramasına yanıt veriliyor`, 'blue', 'system');
    } catch (error) {
        console.error('Error handling offer from:', data.from, error);
        addMessage(`❌ ${data.from}'in sesli aramasına yanıt verilemedi`, 'red', 'system');
    }
});

socket.on('answer', async (data) => {
    if (!currentUsername || data.from === currentUsername) return; // Only process if user has joined
    
    console.log('Received answer from:', data.from);
    
    const pc = peerConnections[data.from];
    if (pc) {
        try {
            console.log('Setting remote description (answer) for:', data.from);
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            addMessage(`✅ Ses bağlantısı ${data.from} ile kuruldu`, 'green', 'system');
        } catch (error) {
            console.error('Error handling answer from:', data.from, error);
            addMessage(`❌ Ses bağlantısı ${data.from} ile kurulamadı`, 'red', 'system');
        }
    }
});

socket.on('ice_candidate', (data) => {
    if (!currentUsername || data.from === currentUsername) return; // Only process if user has joined
    
    console.log('Received ICE candidate from:', data.from);
    
    const pc = peerConnections[data.from];
    if (pc && pc.remoteDescription) {
        try {
            console.log('Adding ICE candidate for:', data.from);
            pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
            console.error('Error adding ICE candidate from:', data.from, error);
        }
    } else {
        console.log('Cannot add ICE candidate - no remote description or peer connection');
    }
});

// Handle mute status updates from other users
socket.on('mute_status_update', (data) => {
    if (!currentUsername) return;
    
    const { username, type, muted } = data;
    
    // Update local tracking
    if (!userMuteStatus[username]) {
        userMuteStatus[username] = {};
    }
    userMuteStatus[username][type] = muted;
    
    // Show notification
    const action = muted ? 'kapalı' : 'açık';
    const device = type === 'microphone' ? 'mikrofon' : 'konuşmacı';
    addMessage(`${username} ${device}larını ${action}ladı`, muted ? 'orange' : 'green', 'mute');
});

// Handle screen sharing updates from other users
socket.on('screen_share_update', (data) => {
    if (!currentUsername) return;
    
    const { username, sharing } = data;
    
    if (sharing) {
        addMessage(`${username} ekranını paylaşıyor`, 'blue', 'system');
    } else {
        addMessage(`${username} ekranını durdurdu`, 'orange', 'system');
        
        // Hide screen share if this user was sharing
        const screenVideo = document.getElementById('screenVideo');
        if (screenVideo && screenVideo.srcObject) {
            // Check if this video stream belongs to the user who stopped sharing
            const videoTracks = screenVideo.srcObject.getVideoTracks();
            if (videoTracks.length > 0) {
                // Hide the screen share
                hideScreenShare();
            }
        }
    }
});

