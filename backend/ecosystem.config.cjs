module.exports = {
  apps: [
    {
      name: 'snake-backend',
      cwd: __dirname,
      script: 'dist/server.js',
      instances: 1,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
