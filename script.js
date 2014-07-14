function Artist(_artistName) {
    this.name = _artistName;
    this.getEvents = function () {
        e = [];
        $.getJSON("http://ws.audioscrobbler.com/2.0/?method=artist.getevents&artist="
                    + this.name + "&api_key=c7e2dc95d8a8f162ab42118cfb0f30db&format=json",
            function (data) {
                $.each(data.events.event, function (i, item) {
                    e.push(new Event(item.title, item.venue.location.city, item.venue.location.country, item.venue.location["get:point"]["geo:lat"], item.venue.location["geo:point"]["geo:long"]));
                });
            }
        );
    };
}

function Event(_title, _city, _country, _lat, _long) {
    this.title = _title;
    this.city = _city;
    this.country = _country;
    this.latitude = _lat;
    this.longitude = _long;
    this.getCoordinates = function () {
        return new giscloud.LonLat(this.longitude, this.latitude);
    };
    this.getEventMarker = function () {
        return new giscloud.FlagMarker(
            this.getCoordinates().toBounds().center(),
            this.title, // title
            this.city + this.country, // content
            giscloud.Color.randomHue(70, 50)
        );
    }

    this.print = function () {
        $("#artistInfo").append("<br/>Event: " + this.title + " | Coo. [lat]" + this.lat + ": [long] " + this.long);
    };
}
