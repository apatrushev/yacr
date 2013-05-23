import os
import tornado.ioloop
import tornado.web
import tornado.websocket

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("index.html")

class RouletteHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        print "WebSocket opened"
    def on_message(self, message):
        print message
    def on_close(self):
        print "WebSocket closed"

root = os.path.join(os.path.dirname(__file__), "static")
handlers = [
    (r"/", MainHandler),
    (r"^/roulette$", RouletteHandler),
]

application = tornado.web.Application(
    handlers,
    template_path=root,
    static_path=root
)

if __name__ == "__main__":
    application.listen(8000)
    tornado.ioloop.IOLoop.instance().start()
