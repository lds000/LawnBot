// Central config for the mobile app.
// PI_HOST is the Controller Pi's IP/hostname accessible from the iPhone.
// When on the home network, use local IP; over Tailscale use 100.x address.
export const PI_HOST = "raspberrypi.local";
export const PI_PORT = 8000;
export const API_BASE = `http://${PI_HOST}:${PI_PORT}/api`;
export const WS_URL = `ws://${PI_HOST}:${PI_PORT}/ws`;
