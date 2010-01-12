Pressed: blog software for Juice
================================

BIG WARNING: This app has a very unstable API. If you start coding
against it expect stuff to break. Things should settle down in a month
or so after it's smoother.

Pressed is a blog application written for [Juice] which can either be
used standalone or embedded in your own application.

To use it as a standalone app just copy `conf/app-sample.json` to
`conf/app.json`, add in your own config, and fire it up using the
included `./script/server`. Now you're done and you can safely ignore
the rest of this README.

[Juice]: http://juicejs.org

## Embedding Pressed

To use it as an embedded app add something like the following to your
`app.urls` definition:

    app.urls = {
      "/?" : "index",

      // Pressed subapp
      "/blog" : {
        app : "/path/to/pressed",
        config : "conf/pressed.json"
      },

      "/styles": { static: "./static/styles" },
      "/scripts": { static: "./static/scripts" }
    }

Pressed will be rooted at the URL used as the key (in this case
`/blog`). The path to the source and config can be relative or absolute.

## Using Pressed's models

All of Pressed's models will be available to your app alongside your own
models. By default they'll use the URL you rooted it at:

    "/blog" : {
      app : "/path/to/pressed",
      config : "conf/pressed.json"
    }

In this example the models will be available at `this.models.blog`. If
you want to use a different key you can specify it manually:

    "/blog" : {
      app : "/path/to/pressed",
      config : "conf/pressed.json",
      name : "pressed"
    }

This will make the models available at `this.models.pressed` regardless
of what you change the URL to.

## Git submodules

If you use Git for source control and want to get fancy, you could
include Pressed as a submodule under `vendor/pressed` and set your
config like:

    "/blog" : {
      app : "vendor/pressed",
      config : "conf/pressed.json"
    }

This enables you to update Pressed whenever you need to without boring
merges whilst also keeping clean checkouts simple. In theory you should
just need a simple:

    git submodule add git://github.com/evilstreak/pressed.git vendor/pressed
