
const MAX_PARTICIPANTS = 3;
const roomStatus = {
	waiting: 'waiting',
	playing: 'playing',
};
let rooms = [];

const socketController = (socket, io) => {

    socket.on('CLIENT:user-joined-room', ({ room_id, user }) => {
		user.socket_id = socket.id;
		const room = rooms.find(room => room.room_id === room_id);
		if (room) {
			if (room.users.length < MAX_PARTICIPANTS) {
				room.users.push({ ...user, userTs: 0 });
			}
		} else {
			rooms.push({
				room_id,
				room_status: roomStatus.waiting,
				users: [{ ...user, userTs: 0, leader: true }],
			});
		}
		socket.join(room_id);
		const participants = rooms.find(room => room.room_id === room_id).users;
		const status = rooms.find(room => room.room_id === room_id).room_status;
		io.sockets.in(room_id).emit('SERVER:participants', { participants });
		io.sockets.in(room_id).emit('SERVER:room-status', { room_status: status });
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

}


module.exports = socketController