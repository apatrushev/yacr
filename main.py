import os
import collections
import click
import tornado.ioloop
import tornado.web
import tornado.websocket


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("index.html")


class RouletteHandler(tornado.websocket.WebSocketHandler):
    offers = collections.OrderedDict()
    peer = dict()

    def on_message(self, message):
        print("Message received: " + message)
        if self in RouletteHandler.peer:
            RouletteHandler.peer[self].write_message(message)
        elif self in RouletteHandler.offers:
            RouletteHandler.offers[self].append(message)
        elif len(RouletteHandler.offers):
            print("Pair created")
            sender, offer = RouletteHandler.offers.popitem(False)
            RouletteHandler.peer[sender] = self
            RouletteHandler.peer[self] = sender
            map(self.write_message, offer)
        else:
            print("New offer registered")
            RouletteHandler.offers[self] = [message]

    def on_close(self):
        if self in RouletteHandler.offers:
            del RouletteHandler.offers[self]
        elif self in RouletteHandler.peer:
            RouletteHandler.peer[self].close()
            del RouletteHandler.peer[self]

    def close(self):
        try:
            tornado.websocket.WebSocketHandler.close(self)
        except:
            pass


@click.command()
@click.option('--port', default=8000, help='Listen port.')
def main(port):
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

    print('Serving HTTP on 0.0.0.0 port {} ...'.format(port))
    application.listen(port)
    tornado.ioloop.IOLoop.instance().start()


if __name__ == "__main__":
    main()
