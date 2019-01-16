// Setup basic express server
const crypto = require('crypto');
var express = require('express');
var app = express();
const multer = require('multer');
var bodyParser = require('body-parser');
const mime = require('mime/lite');
var path = require('path');
var server = require('http').createServer(app);
var io = require('../..')(server);
var port = process.env.PORT || 3000;


var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'))
  },
  filename: function (req, file, cb) {
    let ext = mime.getExtension(file.mimetype);
    var hashname = crypto.createHash('md5').update(file.originalname).digest('hex');
    cb(null, hashname + '-' + Date.now() + '.' + ext)
  }
})

var upload = multer({ storage: storage })


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

app.post('/upload', upload.single('file'), function(req, res) {
  let username = req.body.user;
  let file = req.file;
  const fullUrl = req.protocol + '://' + req.get('host');

  io.emit('upload_success', {
    type: 'image',
    username,
    url: fullUrl + '/uploads/' +file.filename
  });
  res.send('{}')
})

// Routing
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Chatroom

var numUsers = 0;

io.on('connection', (socket) => {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
