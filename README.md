# Harmony API!!

Harmony API is a simple REST server allowing you to query/control a local [Harmony
Home Hub](http://myharmony.com/products/detail/home-hub/). Yes, there are libraries
that can already do this (this server uses one :wink:).

But not all languages have Harmony Hub clients. Also, some times these clients are
complicated to add to your other projects. Harmony API gives you a simple REST server
to control your Harmony Hub, so your control is just a simple HTTP request away.

## Features

* List activities.
* Get current status, including if everything is off, or what the current activity is.
* Turn everything off.
* Start a specific activity.
* query to return a list of available AirPlay endpoints.
* set an AirPlay endpoint to be active. (This can be multiple, since iTunes
  supports it).

## Setup

    npm install
    npm run start

Harmony API will run on port `8282` by default. Use the `PORT` environment
variable to use your own port.

## Docs

This is a quick overview of the service. Read [app.js](app.js) if you need more
info.

:warning: These endpoints may not be stable as this project moves fast towards `1.0.0`.

### Resources

Here's a list of resources that may be returned in a response.

#### Activity Resource

The Activity resource returns all the information you really need for an Activity
set up in your Harmony Hub.

```json
{
  "id": "15233552",
  "label": "Watch TV",
  "isAVActivity": true
}
```

#### Status Resource

The Status resource returns the current state of your Harmony Hub.

```json
{
  "off": false,
  "current_activity": {
    "id": "15233552",
    "label": "Watch TV",
    "isAVActivity": true
  }
}
```

### Methods

These are the endpoints you can hit to do things.

#### Info
  Use these endpoints to query the current state of your Harmony Hub.

    GET /status => StatusResource
    GET /activities => {:activities => [ActivityResource, ActivityResource, ...]}

#### Control
  Use these endpoints to control your devices through your Harmony Hub.

    PUT /off => NowPlayingResource => {message: "ok"}
    POST /start_activity?activity_name=Watch%20TV => {message: "ok"}

## To Do

- [ ] Support multiple Harmony Hubs
- [ ] Support raw commands to control individual devices


## Contributions

* fork
* create a feature branch
* open a Pull Request
