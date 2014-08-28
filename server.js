HOST = null; // localhost
PORT = process.env.PORT || 5000;
var fs = require("fs");

var users={};
users["hash"]="name"
// when the daemon started
var starttime = (new Date()).getTime();

var mem = process.memoryUsage();
// every 10 seconds poll for the memory.
setInterval(function () {
  mem = process.memoryUsage();
}, 10*1000);


var fu = require("./fu"),
    sys = require("sys"),
    url = require("url"),
    qs = require("querystring");

var MESSAGE_BACKLOG = 20,
    SESSION_TIMEOUT = 25 * 1000;

var channel = new function () {
  var messages = [],
      callbacks = [];

  this.appendMessage = function (nick, type, text) {
    var m = { nick: nick
            , type: type // "msg", "join", "part"
            , text: text
            , timestamp: (new Date()).getTime()
            };

    switch (type) {
      case "msg":
     //   sys.puts("<" + nick + "> " + text);
        break;
      case "join":
     //   sys.puts(nick + " join");
        break;
      case "part":
     //   sys.puts(nick + " part");
        break;
    }

    messages.push( m );

    while (callbacks.length > 0) {
      callbacks.shift().callback([m]);
    }

    while (messages.length > MESSAGE_BACKLOG)
      messages.shift();
  };

  this.query = function (since, callback) {
    var matching = [];
    for (var i = 0; i < messages.length; i++) {
      var message = messages[i];
      if (message.timestamp > since)
        matching.push(message)
    }

    if (matching.length != 0) {
      callback(matching);
    } else {
      callbacks.push({ timestamp: new Date(), callback: callback });
    }
  };

  // clear old callbacks
  // they can hang around for at most 20 seconds.
  setInterval(function () {
    var now = new Date();
    while (callbacks.length > 0 && now - callbacks[0].timestamp > 20*1000) {
      callbacks.shift().callback([]);
    }
  }, 3000);
};

var sessions = {};

function createSession (hash,nick) {
  if (nick.length > 50) return null;
  //if (/[^\w_\-^!]/.exec(nick)) return null;

  for (var i in sessions) {
    var session = sessions[i];
    if (session && session.hash === hash) return null;
  }

  var session = {
    hash: hash,
    nick: nick,
    id: Math.floor(Math.random()*99999999999).toString(),
    timestamp: new Date(),

    poke: function () {
      session.timestamp = new Date();
    },

    destroy: function () {
      channel.appendMessage(session.nick, "part");
      delete sessions[session.id];
    }
  };

  sessions[session.id] = session;
  return session;
}

// interval to kill off old sessions
setInterval(function () {
  var now = new Date();
  for (var id in sessions) {
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];

    if (now - session.timestamp > SESSION_TIMEOUT) {
      session.destroy();
    }
  }
}, 1000);

fu.listen(Number(process.env.PORT || PORT), HOST);

fu.get("/", fu.staticHandler("index.html"));
//fu.get("/style.css", fu.staticHandler("css/style.css"));
//fu.get("/client.js", fu.staticHandler("client.js"));
//fu.get("/jquery.js", fu.staticHandler("js/jquery.js"));
//fu.get("/js/jquery.sha256.js", fu.staticHandler("js/jquery.sha256.js"));
//fu.get("/js/bootstrap.min.js", fu.staticHandler("js/bootstrap.min.js"));
//fu.get("/css/bootstrap.min.css", fu.staticHandler("css/bootstrap.min.css"));


fu.get("/who", function (req, res) {
  var nicks = [];
  for (var id in sessions) {
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];
    nicks.push(session.nick);
  }
  res.simpleJSON(200, { nicks: nicks
                      , rss: mem.rss
                      });
});

fu.get("/getSmiles", function (req, res) {
  var smiles = [];  
  fs.readFile(PUBLICFOLDER+"/smiles/smiles.json", "utf8",function (err, data) {
      if (err) {
    //    sys.puts("Error loading " + err);
      } else {
        res.simpleJSON(200, JSON.parse(data));
      }
    });
  
  
  
});


fu.get("/join", function (req, res) {
  var hash = qs.parse(url.parse(req.url).query).hash;
//sys.puts("!!!!!!!!!!!!!!!!!!!!!: " + hash + "@" + users[hash]);
  if (hash == null || users[hash]==undefined || hash.length == 0) {
    res.simpleJSON(400, {error: "No such user"});
    return;
  }
  var nick = users[hash];
  var session = createSession(hash,nick);
  if (session == null) {
    res.simpleJSON(400, {error: "You are already connected"});
    return;
  }

  //sys.puts("connection: " + nick + "@" + res.connection.remoteAddress);

  channel.appendMessage(session.nick, "join");
  res.simpleJSON(200, { id: session.id
                      , nick: session.nick
                      , rss: mem.rss
                      , starttime: starttime
                      });
});

fu.get("/part", function (req, res) {
  var id = qs.parse(url.parse(req.url).query).id;
  var session;
  if (id && sessions[id]) {
    session = sessions[id];
    session.destroy();
  }
  res.simpleJSON(200, { rss: mem.rss });
});

fu.get("/recv", function (req, res) {
  if (!qs.parse(url.parse(req.url).query).since) {
    res.simpleJSON(400, { error: "Must supply since parameter" });
    return;
  }
  var id = qs.parse(url.parse(req.url).query).id;
  var session;
  if (id && sessions[id]) {
    session = sessions[id];
    session.poke();
  }

  var since = parseInt(qs.parse(url.parse(req.url).query).since, 10);

  channel.query(since, function (messages) {
    if (session) session.poke();
    res.simpleJSON(200, { messages: messages, rss: mem.rss });
  });
});

fu.get("/send", function (req, res) {
  var id = qs.parse(url.parse(req.url).query).id;
  var text = qs.parse(url.parse(req.url).query).text;

  var session = sessions[id];
  if (!session || !text) {
    res.simpleJSON(400, { error: "No such session id" });
    return;
  }

  session.poke();

  channel.appendMessage(session.nick, "msg", text);
  res.simpleJSON(200, { rss: mem.rss });
});

