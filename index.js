var express = require('express'), app=express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

//All username of the connected users
var usernames= {};

//Direction where it starts to search for a file
var publicDir = require('path').join(__dirname);
app.use(express.static(publicDir));

//multer for multimedia upload
const multer= require('multer');
var path = require('path');

//Option where the uploaded files will be saved and with what name
var storageOptions = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, 'public/uploads');
    },

    filename: function(req, file, callback) {
        var fname = file.fieldname + '-' + Date.now() + path.extname(file.originalname);

        callback(null, fname);

    }
});

//complete multer var for the upload
var upload = multer({storage : storageOptions});


/**
 * when a user conntects to the server it will direct him to the index.html.
 */
app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});


//Its the port
server.listen(process.env.PORT || 3000);
console.log('Server running...');



/**
 * Function is called when someone connects with the Server
 */
io.sockets.on('connection', function(socket){
    console.log('Socket Connected...');


    /**
     * This function is called when someone wants to share a file with the chat.
     * It can upload and share sounds, images and videos.
     * @param req stores the information of the file.
     */
    app.post('/', upload.any(), function upload(req,res, next){
        console.log((req.files[0].path).split(".").length + " "+ req.body.selectall +  socket.username);

        var ending = (req.files[0].path).split(".")[(req.files[0].path).split(".").length-1];
        if(req.body.selectall === "1. Send it to everyone") {
            if (ending === "jpg" || ending === "jepg" || ending === "png")
                io.sockets.emit('img upload', {file: req.files[0].path, user: socket.username})
            if (ending === "mp4")
                io.sockets.emit('video upload', {file: req.files[0].path})
            if (ending === "mp3" || ending === "mpeg")
                io.sockets.emit('sound upload', {file: req.files[0].path, user: socket.username})
        }
        else{
            var name = req.body.selectall.substr(req.body.selectall.indexOf(" "));
            name = name.trim();

            console.log(name);

            if(name in usernames){
                if (ending === "jpg" || ending === "jepg" || ending === "png")
                    usernames[name].emit('img upload', {file: req.files[0].path})
                if (ending === "mp4")
                    usernames[name].emit('video upload', {file: req.files[0].path})
                if (ending === "mp3" || ending === "mpeg")
                    usernames[name].emit('sound upload', {file: req.files[0].path})
            }
        }

    });


    /**
     *    Function is called when someone wants to send a chat message.
     *    Furthermore the message will be analyze if the sender wants to send a normal message
     *    or wants to whisper to someone ("/w [name]"). If the message is "/list" it will open a list
     *    of all users. "/listoff" will close the user list.
     *    An error gets send back when the username doesnt exits or
     *    when a user tries to whisper without a message.
     *
     *    @param data stores the message. "/w " to whisper. "/list" to open the list. "/listoff" to close the list.
     */
    socket.on('send message', function(data,callback){
        var msg= data.trim();
        if(msg.substr(0,3)=== '/w '){
            msg= msg.substr(3);
            var ind= msg.indexOf(' ');
            console.log(ind);
            if(ind !== -1){
                var name= msg.substr(0,ind);
                var msg= msg.substr(ind+1);

                if(name in usernames){
                    usernames[name].emit('whisper',{msg: msg, user: socket.username});
                    console.log('private');
                }else{
                    callback('Error enter a valid user!');
                }
            }else{
                callback('Error please enter a message for your whisper.')
            }

        }else if(msg === '/list'){
            socket.emit('liston');

        }else if(msg === '/listoff') {
            socket.emit('listoff');
        }
        else{
            io.sockets.emit('new message',{msg: msg, user: socket.username});
        }

    });

    /**
     *  Function is called when a new user logins in with a username. If the username
     *  is already taken its send a error back. Otherwise it stores the username in the server
     *  by updating the username-list.
     *  @param data stores the username.
     */
    socket.on('new user', function(data, callback){
        if(data in usernames){
            callback(false);
        }else{
            callback(true);
            socket.username = data;
            usernames[socket.username] = socket;
            io.sockets.emit('user connect', data);
            updateUsernames();
        }
    });


    /**
     * Function is called when someone exits from the chat and deletes the username from the server
     * by updating the username-list.
     */
    socket.on('disconnect', function () {
        if(!socket.username) {
            return;
        }
        io.sockets.emit('user disconnect', socket.username);
        delete usernames[socket.username];
        updateUsernames();
    })


    /**
     * Updates the username list after someone connects to or disconnects from the chat.
     */
    function updateUsernames(){
        io.sockets.emit('usernames', Object.keys(usernames));
    }
});
