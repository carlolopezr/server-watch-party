const MAX_PARTICIPANTS = 3;
const roomStatus = {
	waiting: 'waiting',
	playing: 'playing',
};

const movieState = {
	started: 'started',
	notStarted: 'not-started',
};
let rooms = [];

const socketController = (socket, io) => {
	const totalConnections = io.sockets.sockets.size;
	console.log(`Total connections: ${totalConnections}`);
	socket.on('CLIENT:user-joined-room', ({ room_id, user }) => {
		user.socket_id = socket.id;
		const room = rooms.find(room => room.room_id === room_id);
		if (room) {
			const isUserInRoom = room.users.find(({ user_id }) => user_id === user.user_id);
			if (!isUserInRoom) {
				if (room.users.length < MAX_PARTICIPANTS) {
					room.users.push({ ...user, userTs: 0 });
					socket.join(room_id);
				}
			}
		} else {
			rooms.push({
				room_id,
				room_status: roomStatus.waiting,
				movie_state: 'not-started',
				users: [{ ...user, userTs: 0, leader: true }],
				messages: [],
			});
			socket.join(room_id);
		}
		const participants = rooms.find(room => room.room_id === room_id).users;
		const room_status = rooms.find(room => room.room_id === room_id).room_status;
		const messages = rooms.find(room => room.room_id === room_id).messages;
		io.sockets.in(room_id).emit('SERVER:participants', { participants });
		io.sockets.in(room_id).emit('SERVER:room-status', { room_status: room_status });
		io.sockets.in(room_id).emit('SERVER:messages', { messages });
	});

	socket.on('CLIENT:start-movie', ({ room_id, room_status, movie_state }) => {
		const room = rooms.find(room => room.room_id === room_id);
		room.movie_state = movie_state;
		room.room_status = room_status;
		io.sockets.in(room_id).emit('SERVER:started-movie', { room_status: room_status, movie_state });
		io.sockets.in(room_id).emit('SERVER:room-status', { room_status: room_status });
	});

	socket.on('CLIENT:user-seek', ({ room_id, seek_time_stamp, playing }) => {
		const room = rooms.find(room => room.room_id === room_id);
		if (room) {
			room.users.forEach(user => {
				user.userTs = seek_time_stamp;
			});
			socket.to(room_id).emit('SERVER:user-seeked', { seek_time_stamp, playing });
		}
	});

	socket.on('CLIENT:user-movie-state', ({ room_id, user_id, movie_state }) => {
		const room = rooms.find(room => room.room_id === room_id);
		if (room) {
			const user = room.users.find(user => user.user_id === user_id);
			if (user) {
				user.user_movie_state = movie_state;
			}
			io.sockets.in(room_id).emit('SERVER:participants', { participants: room.users });
			const isEveryUserInRoom = room.users.every(user => user.user_movie_state === 'not-started');
			if (isEveryUserInRoom) {
				room.users.forEach(user => {
					user.userTs = 0;
				});
				io.sockets.in(room_id).emit('SERVER:room-status', { room_status: roomStatus.waiting });
			}
		}
	});

	socket.on('CLIENT:movie-ended', ({ room_id, room_status, movie_state }) => {
		const room = rooms.find(room => room.room_id === room_id);
		room.users.forEach(user => {
			user.userTs = 0;
		});
		room.movie_state = movie_state;
		room.room_status = room_status;
		io.sockets.in(room_id).emit('SERVER:movie-ended', { room_status: room_status, movie_state });
		io.sockets.in(room_id).emit('SERVER:room-status', { room_status: room_status });
	});

	socket.on('CLIENT:play-pause', ({ room_id, playing }) => {
		socket.to(room_id).emit('SERVER:play-pause', { playing });
	});

	socket.on('CLIENT:mouse-move', ({ room_id }) => {
		socket.to(room_id).emit('SERVER:mouse-move');
	});

	socket.on('CLIENT:on-progress', ({ room_id, user_time_stamp, user_id, playing }) => {
		const room = rooms.find(room => room.room_id === room_id);
		if (room) {
			const user = room.users.find(user => user.user_id === user_id);
			if (user) {
				user.userTs = user_time_stamp;
				const usersTimes = room.users.map(user => user.userTs);
				const maxTime = Math.max(...usersTimes);
				io.sockets.in(room_id).emit('SERVER:time-stamp', { maxTime, playing });
			}
		}
	});

	socket.on('CLIENT:send-message', ({ room_id, user, msg, time, message_id }) => {
		const room = rooms.find(room => room.room_id === room_id);
		const newMessage = { msg, user, time, message_id };
		if (room) {
			room.messages.push(newMessage);
			socket.to(room_id).emit('SERVER:sent-message', { msg: newMessage });
		}
	});

	socket.on('CLIENT:signal', ({ room_id, signalData }) => {
		const sender = rooms.flatMap(room => room.users).find(user => user.socket_id === socket.id);
		const recipient = rooms.flatMap(room => room.users).find(user => user.user_id !== sender.user_id);

		if (sender && recipient) {
			io.to(recipient.socket_id).emit('SERVER:signal', { signalData, user_id: sender.user_id });
		}
	});

	socket.on('disconnect', () => {
		rooms.forEach(room => {
			const remainingUsers = room.users.filter(({ socket_id }) => socket_id !== socket.id);
			room.users = remainingUsers;
			if (remainingUsers.length === 0) {
				const remainingRooms = rooms.filter(({ room_id }) => room_id !== room.room_id);
				rooms = remainingRooms;
			} else {
				io.sockets.in(room.room_id).emit('SERVER:participants', { participants: remainingUsers });
			}
		});
	});
};

module.exports = socketController;
