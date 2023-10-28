const express = require('express')
const cors = require('cors')
const http = require('http')
const socketIo  = require('socket.io')
const socketController = require('../sockets/controller')


class Server {

    constructor() {
        this.app = express()
        this.server = http.createServer(this.app)
        this.io = socketIo(this.server, {
            cors: {
                origin:'*'
            }
        })
        this.port = process.env.PORT || 3001

        this.middlewares();
        this.sockets();
    }

    middlewares() {
        this.app.options('*', cors());
        this.app.use(cors());
        this.app.use(express.static('public'));
    }

    sockets() {
        this.io.on('connection', (socket) => {
            socketController(socket, this.io)
        })
    }

    listen() {
		this.server.listen(this.port, () => {
			console.log('Servidor corriendo en puerto', this.port);
		});
    }
}    

module.exports = Server