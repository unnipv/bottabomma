module.exports = {
  apps: [
    {
      name: 'bottabomma-ngrok',
      script: 'ngrok',
      args: 'http 127.0.0.1:3010 --log stdout',
      interpreter: 'none'
    }
  ]
};
