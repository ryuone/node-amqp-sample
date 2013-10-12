var express = require('express'),
    http = require('http'),
    path = require('path'),
    amqp = require('amqp');

var app = express();

app.configure(function(){
    app.set('port', process.env.PORT || 3000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.static(path.join(__dirname, 'public')));
});

app.connectionStatus = 'No server connection';

http.createServer(app).listen(app.get('port'), function(){
    console.log("RabbitMQ + Node.js app running on AppFog!");
});

console.log("start servert on " + app.get('port'));

connect();

app.get('/', function(req, res){
    res.render('index.jade', {
        title: 'Welcome to RabbitMQ and Node/Express',
        connectionStatus: app.connectionStatus
    });
});
function connect(){
    app.rabbitMqConnection = amqp.createConnection({ host: 'localhost' });
    app.rabbitMqConnection.on('ready', function(){
        console.log("*****************************************");
        console.log("RabbitMQ ready to use....");

        app.e = app.rabbitMqConnection.exchange('test-exchange');
        console.log("Exchange created.... :", app.e.name);

        app.connectionStatus = 'Connected!';
    })
}
app.get('/message-service', function(req, res){
    res.render('message-service.jade',
        {
            title: 'Welcome to the messaging service',
            sentMessage: ''
        });
});
app.post('/newMessage', function(req, res){
    console.log("** Post new message **");
    var newMessage = req.body.newMessage;
    app.q = app.rabbitMqConnection.queue('test-queue', {
        closeChannelOnUnsubscribe: true
    });
    app.q.on('queueDeclareOk', function(args) {
        console.log('Queue opened', args);
        console.log(app.q.name, "bind to", app.e.name, ".....");
        app.q.bind(app.e, '#');

        app.q.on('queueBindOk', function() {
            console.log('Queue bound');

            app.q.on('basicConsumeOk', function(){
                console.log("publish message via ", app.e.name, ".....");
                app.e.publish('test-queue', { message: newMessage });
            });

            var subscribed = app.q.subscribe(function(msg, headers, deliveryInfo){
                console.log("msg:", msg, deliveryInfo.routingKey);
                res.render('message-service.jade', {
                    title: 'You\'ve got message!',
                    sentMessage: msg.message
                });
            });
            subscribed.addCallback(function(ok){
                console.log("addCallback called!!! :", ok.consumerTag);
                app.q.unsubscribe(ok.consumerTag);
            });
        });
    })
});
