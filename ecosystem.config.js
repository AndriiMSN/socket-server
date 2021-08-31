module.exports = {
    apps: [
        {
            name: "chat server",
            exec_mode: "cluster",
            instances: "max",
            script: "./app.js",
            args: "start"
        }
    ]
};