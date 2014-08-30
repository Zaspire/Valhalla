function onMouseDown(event) {
    if (event.item)
        return;
    var circle = new Path.Circle(event.point, 50);
    circle.fillColor = 'red';

    circle.onMouseDown = function(event) {
        if (this.fillColor == 'red')
            this.fillColor = 'black';
        else
            this.fillColor = 'red';
    }
}
