/*
 * Copyright (C) 2012 David Geary. This code is from the book
 * Core HTML5 Canvas, published by Prentice-Hall in 2012.
 *
 * License:
 *
 * Permission is hereby granted, free of charge, to any person 
 * obtaining a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * The Software may not be used to create training material of any sort,
 * including courses, books, instructional videos, presentations, etc.
 * without the express written consent of David Geary.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
*/

var COREHTML5 = COREHTML5 || { };

// Constructor................................................................

COREHTML5.polygonExample = function() {
   var self = this;
   
   this.polygonsTransparencySlider = new COREHTML5.Slider('navy', 
                                                  'cornflowerblue', // stroke style
                                                   1.0,  // knob percent
                                                   90,   // take up % of width
                                                   55);  // take up % of height

   this.canvas = document.getElementById('polygons-canvas');
   this.context = this.canvas.getContext('2d');
   this.eraseAllButton = document.getElementById('polygons-erase-all-button');
   this.strokeStyleInput = document.getElementById('polygons-stroke-style-input');
   this.startAngleSelect = document.getElementById('polygons-start-angle-select');

   this.fillStyleInput = document.getElementById('polygons-fill-style-input');
   this.fillCheckbox = document.getElementById('polygons-fillCheckbox');

   this.sidesSelect = document.getElementById('polygons-sides-select');

   this.CENTROID_RADIUS = 10,
   this.CENTROID_STROKE_STYLE = 'rgba(0, 0, 0, 0.8)';
   this.CENTROID_FILL_STYLE ='rgba(255, 255, 255, 0.2)';
   this.CENTROID_SHADOW_COLOR = 'rgba(255, 255, 255, 0.4)';

   this.DEGREE_RING_MARGIN = 35;
   this.TRACKING_RING_MARGIN = 55;
   this.DEGREE_ANNOTATIONS_FILL_STYLE = 'rgba(0, 0, 230, 0.8)';
   this.DEGREE_ANNOTATIONS_TEXT_SIZE = 11;
   this.DEGREE_OUTER_RING_MARGIN = this.DEGREE_RING_MARGIN;
   this.TICK_WIDTH = 10;
   this.TICK_LONG_STROKE_STYLE = 'rgba(100, 140, 230, 0.9)';
   this.TICK_SHORT_STROKE_STYLE = 'rgba(100, 140, 230, 0.7)';

   this.TRACKING_RING_STROKING_STYLE = 'rgba(100, 140, 230, 0.3)';
   this.drawingSurfaceImageData;
   
   this.mousedown = {};
   this.rubberbandRect = {};

   this.dragging = false;
   this.creating = false;
   this.moving = false;
   this.annotationsVisible = false;
   this.draggingOffsetX;
   this.draggingOffsetY;

   this.sides = 8;
   this.startAngle = 0;

   this.guidewires = true;

   this.editing = false;
   this.rotatingLockEngaged = false;
   this.rotatingLockAngle;
   this.polygonRotating;

   this.polygonOpacity = 1.0;
   this.armed = false;

   this.polygons = [];

   // Event handlers................................................

   this.canvas.ontouchstart = function (e) {
      e.preventDefault(); // prevent cursor change
      self.onmousedown({ x: e.pageX, y: e.pageY });
   };

   this.canvas.onmousedown = function (e) {
      e.preventDefault(); // prevent cursor change
      self.onmousedown(self.windowToCanvas(e));
   };

   this.onmousedown = function (loc) {
      var angle,
          radius,
          trackingRadius;

      if (self.rotatingLockEngaged) {
         self.stopRotatingPolygon(loc);
         self.context.clearRect(0, 0, self.canvas.width, self.canvas.height);
         self.drawGrid('lightgray', 10, 10);
         self.drawPolygons();
         return;
      }

      self.armed = self.getSelectedPolygon(loc),

      self.strokeStyleInput.blur();
      self.fillStyleInput.blur();

      self.strokeStyleInput.color.hidePicker();
      self.fillStyleInput.color.hidePicker();

      if (!self.armed) {
         self.startDragging(loc);
         self.creating = true;
      }
      else {
         self.draggingOffsetX = loc.x - self.armed.x;
         self.draggingOffsetY = loc.y - self.armed.y;
      }
   };

   this.canvas.ontouchmove = function (e) {
      e.preventDefault(); // prevent selections
      self.onmousemove({ x: e.pageX, y: e.pageY });
   };

   this.canvas.onmousemove = function (e) {
      e.preventDefault(); // prevent selections
      self.onmousemove(self.windowToCanvas(e));
   };
   
   this.onmousemove = function (loc) {
      var radius = Math.sqrt(Math.pow(loc.x - self.dragging.x, 2) + Math.pow(loc.y - self.dragging.y, 2)),
          angle;

      if (self.rotatingLockEngaged) {
         angle = Math.atan((loc.y - self.polygonRotating.y) /
                           (loc.x - self.polygonRotating.x))
                           - self.rotatingLockAngle;

         self.redraw();
   
         self.drawPolygon(self.polygonRotating, angle);
         self.drawRotationAnnotations(loc);
      }

      if (self.armed) {
         if (loc.x !== self.mousedown.x && loc.y !== self.mousedown.y) {
            self.moving = self.armed;
            self.armed = undefined;
         }
      }

      if (self.moving) {
         self.context.clearRect(0, 0, self.canvas.width, self.canvas.height);
         self.drawGrid('lightgray', 10, 10);
         self.moving.x = loc.x - self.draggingOffsetX;
         self.moving.y = loc.y - self.draggingOffsetY;
         self.drawPolygons();
      }
      else if (self.creating) {
         self.restoreDrawingSurface();
         self.updateRubberband(loc, self.sides, self.startAngle);

         if (self.guidewires) {
            self.drawGuidewires(self.mousedown.x, self.mousedown.y);
         }
      }
   };

   this.canvas.ontouchend = function (e) {
      e.preventDefault();
      this.onmouseup( { x: e.pageX, y: e.pageY });
   };

   this.canvas.onmouseup = function (e) {
      self.onmouseup(self.windowToCanvas(e));
   };

   this.onmouseup = function (loc) {
      if (self.armed) {
         self.polygonRotating = self.armed;

         self.drawRotationAnnotations(loc);

         if (!self.rotatingLockEngaged) {
            self.rotatingLockEngaged = true;
            self.rotatingLockAngle = Math.atan((loc.y - self.polygonRotating.y) / (loc.x - self.polygonRotating.x));
         }

         self.armed = false;
      }
      if (self.creating) {
         self.context.clearRect(0, 0, self.canvas.width, self.canvas.height);
         self.restoreDrawingSurface();
         self.updateRubberband(loc);
         self.polygons.push(self.polygon);
      }
      
      self.armed = false;
      self.dragging = false;
      self.creating = false;
      self.moving = false;
   };


   this.eraseAllButton.onclick = function (e) {
      self.context.clearRect(0, 0, self.canvas.width, self.canvas.height);
      self.drawGrid('lightgray', 10, 10);
      self.saveDrawingSurface(); 
      self.polygons = [];
   };

   this.strokeStyleInput.onchange = function (e) {
      self.context.strokeStyle = self.strokeStyleInput.value;
   };

   this.fillStyleInput.onchange = function (e) {
      self.context.fillStyle = self.fillStyleInput.value;
   };

   this.polygonsTransparencySlider.addChangeListener(function (e) {
      var percent = self.polygonsTransparencySlider.knobPercent;
      self.polygonsTransparencySlider.fillStyle = 'rgba(80, 140, 240, ' + (percent * 255).toFixed(0) + ')';
      self.polygonsTransparencySlider.opacity = percent < 0.1 ? 0.1 : percent;
      self.polygonOpacity = self.polygonsTransparencySlider.opacity;
   });

   // Initialization................................................

   this.context.strokeStyle = this.strokeStyleInput.value;
   this.context.fillStyle = this.fillStyleInput.value;

   this.drawGrid('lightgray', 10, 10);

   if (navigator.userAgent.indexOf('Opera') === -1)
      this.context.shadowColor = 'rgba(0, 0, 0, 0.4)';

   this.context.shadowOffsetX = 2;
   this.context.shadowOffsetY = 2;
   this.context.shadowBlur = 4;

   this.context.textAlign = 'center';
   this.context.textBaseline = 'middle';
};

COREHTML5.polygonExample.prototype = {
drawGrid: function (color, stepx, stepy) {
   this.context.save()

   this.context.shadowColor = undefined;
   this.context.shadowBlur = 0;
   this.context.shadowOffsetX = 0;
   this.context.shadowOffsetY = 0;
   
   this.context.strokeStyle = color;
   this.context.fillStyle = '#ffffff';
   this.context.lineWidth = 0.5;
   this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height);

   for (var i = stepx + 0.5; i < this.context.canvas.width; i += stepx) {
     this.context.beginPath();
     this.context.moveTo(i, 0);
     this.context.lineTo(i, this.context.canvas.height);
     this.context.stroke();
   }

   for (var i = stepy + 0.5; i < this.context.canvas.height; i += stepy) {
     this.context.beginPath();
     this.context.moveTo(0, i);
     this.context.lineTo(this.context.canvas.width, i);
     this.context.stroke();
   }

   this.context.restore();
},

windowToCanvas: function (e) {
   var x = e.x || e.clientX,
       y = e.y || e.clientY,
       bbox = this.canvas.getBoundingClientRect();

   return { x: x - bbox.left * (this.canvas.width  / bbox.width),
            y: y - bbox.top  * (this.canvas.height / bbox.height)
          };
},

// Save and restore drawing surface..............................

saveDrawingSurface: function () {
   this.drawingSurfaceImageData = this.context.getImageData(0, 0,
                             this.canvas.width,
                             this.canvas.height);
},

restoreDrawingSurface: function () {
   this.context.putImageData(this.drawingSurfaceImageData, 0, 0);
},

// Rubberbands...................................................

updateRubberbandRectangle: function (loc) {
   this.rubberbandRect.width = Math.abs(loc.x - this.mousedown.x);
   this.rubberbandRect.height = Math.abs(loc.y - this.mousedown.y);

   if (loc.x > this.mousedown.x) this.rubberbandRect.left = this.mousedown.x;
   else                     this.rubberbandRect.left = loc.x;

   if (loc.y > this.mousedown.y) this.rubberbandRect.top = this.mousedown.y;
   else                     this.rubberbandRect.top = loc.y;
}, 

drawRubberbandShape: function (loc, sides, startAngle) {
   if (this.moving) {
     this.polygon = new Polygon(loc.x + this.offsetX, loc.y + this.offsetY,
                     this.rubberbandRect.width, 
                     parseInt(this.sidesSelect.value),
                     (Math.PI / 180) * parseInt(this.startAngleSelect.value),
                     this.context.strokeStyle,
                     this.context.fillStyle,
                     this.fillCheckbox.checked);
   }
   else {
     this.polygon = new Polygon(this.mousedown.x, this.mousedown.y,
                     this.rubberbandRect.width, 
                     parseInt(this.sidesSelect.value),
                     (Math.PI / 180) * parseInt(this.startAngleSelect.value),
                     this.context.strokeStyle,
                     this.context.fillStyle,
                     this.fillCheckbox.checked);
   }
   this.polygon.opacity = this.polygonOpacity;
   this.drawPolygon(this.polygon);
},

updateRubberband: function (loc, sides, startAngle) {
   this.updateRubberbandRectangle(loc);
   this.drawRubberbandShape(loc, sides, startAngle);
},

// Guidewires....................................................

drawHorizontalLine: function  (y) {
   this.context.beginPath();
   this.context.moveTo(0,y+0.5);
   this.context.lineTo(this.context.canvas.width,y+0.5);
   this.context.stroke();
},

drawVerticalLine: function (x) {
   this.context.beginPath();
   this.context.moveTo(x+0.5,0);
   this.context.lineTo(x+0.5,this.context.canvas.height);
   this.context.stroke();
},

drawGuidewires: function (x, y) {
   this.context.save();
   this.context.strokeStyle = 'rgba(0,0,230,0.4)';
   this.context.lineWidth = 0.5;
   this.drawVerticalLine(x);
   this.drawHorizontalLine(y);
   this.context.restore();
},

// Drawing .............................................

drawPolygons: function () {
   var polygon;
   
   for(var i=0; i < this.polygons.length; ++i) {
      polygon = this.polygons[i];
      
      polygon.stroke(this.context);

      if (polygon.filled) {
         polygon.fill(this.context);
      }
   }
},

drawCentroid: function (polygon) {
   this.context.beginPath();
   this.context.save();
   this.context.strokeStyle = this.CENTROID_STROKE_STYLE;
   this.context.fillStyle = this.CENTROID_FILL_STYLE;
   this.context.shadowColor = this.CENTROID_SHADOW_COLOR;
   this.context.arc(polygon.x, polygon.y, this.CENTROID_RADIUS, 0, Math.PI*2, false);
   this.context.stroke();
   this.context.fill();
   this.context.restore();
},

drawCentroidGuidewire: function (loc, polygon) {
   var angle = Math.atan( (loc.y - polygon.y) / (loc.x - polygon.x) ),
       radius, endpt;

  radius = polygon.radius + this.TRACKING_RING_MARGIN;
  angle = angle - this.rotatingLockAngle;

  if (loc.x >= polygon.x) {
      endpt = { x: polygon.x + radius * Math.cos(angle),
                y: polygon.y + radius * Math.sin(angle)
      };
   }
   else {
      endpt = { x: polygon.x - radius * Math.cos(angle),
                y: polygon.y - radius * Math.sin(angle)
      };
   }
   
   this.context.save();
   this.context.beginPath();
   this.context.moveTo(polygon.x, polygon.y);
   this.context.lineTo(endpt.x, endpt.y);
   this.context.stroke();

   this.context.beginPath();
   this.context.arc(endpt.x, endpt.y, 5, 0, Math.PI*2, false);
   this.context.stroke();
   this.context.fill();

   this.context.restore();
},

drawDegreeOuterDial: function (polygon) {
   this.context.save();
   this.context.strokeStyle = 'rgba(0, 0, 0, 0.1)';
   this.context.arc(polygon.x, polygon.y,
               polygon.radius + this.DEGREE_OUTER_RING_MARGIN,
               0, Math.PI*2, true);
   this.context.restore();
},

drawDegreeAnnotations: function (polygon) {
   var radius = polygon.radius + this.DEGREE_RING_MARGIN;

   this.context.save();
   this.context.fillStyle = this.DEGREE_ANNOTATIONS_FILL_STYLE;
   this.context.font = this.DEGREE_ANNOTATIONS_TEXT_SIZE + 'px Helvetica'; 
   
   for (var angle=0; angle < 2*Math.PI; angle += Math.PI/8) {
      this.context.beginPath();
      this.context.fillText((angle * 180 / Math.PI).toFixed(0),
         polygon.x + Math.cos(angle) * (radius - this.TICK_WIDTH*2),
         polygon.y + Math.sin(angle) * (radius - this.TICK_WIDTH*2));
   }
   this.context.restore();
},
   
drawDegreeDialTicks: function (polygon) {
   var radius = polygon.radius + this.DEGREE_RING_MARGIN,
       ANGLE_MAX = 2*Math.PI,
       ANGLE_DELTA = Math.PI/64;

   this.context.save();
   
   for (var angle = 0, cnt = 0; angle < ANGLE_MAX; angle += ANGLE_DELTA, ++cnt) {
      this.context.beginPath();

      if (cnt % 4 === 0) {
         this.context.moveTo(polygon.x + Math.cos(angle) * (radius - this.TICK_WIDTH),
                        polygon.y + Math.sin(angle) * (radius - this.TICK_WIDTH));
         this.context.lineTo(polygon.x + Math.cos(angle) * (radius),
                        polygon.y + Math.sin(angle) * (radius));
         this.context.strokeStyle = this.TICK_LONG_STROKE_STYLE;
         this.context.stroke();
      }
      else {
         this.context.moveTo(polygon.x + Math.cos(angle) * (radius - this.TICK_WIDTH/2),
                        polygon.y + Math.sin(angle) * (radius - this.TICK_WIDTH/2));
         this.context.lineTo(polygon.x + Math.cos(angle) * (radius),
                        polygon.y + Math.sin(angle) * (radius));
         this.context.strokeStyle = this.TICK_SHORT_STROKE_STYLE;
         this.context.stroke();
      }

      this.context.restore();
   }
},

drawDegreeTickDial: function (polygon) {
   this.context.save();
   this.context.strokeStyle = 'rgba(0, 0, 0, 0.1)';
   this.context.beginPath();
   this.context.arc(polygon.x, polygon.y, polygon.radius + this.DEGREE_RING_MARGIN - this.TICK_WIDTH, 0, Math.PI*2, false);
   this.context.stroke();
   this.context.restore();
},

drawTrackingDial: function (polygon) {
   this.context.save();
   this.context.shadowColor = 'rgba(0, 0, 0, 0.7)';
   this.context.shadowOffsetX = 3,
   this.context.shadowOffsetY = 3,
   this.context.shadowBlur = 6,
   this.context.strokeStyle = this.TRACKING_RING_STROKING_STYLE;
   this.context.beginPath();
   this.context.arc(polygon.x, polygon.y, polygon.radius +
               this.TRACKING_RING_MARGIN, 0, Math.PI*2, false);
   this.context.stroke();
   this.context.restore();
},

drawRotationAnnotations: function (loc) {
   if (this.polygonRotating && this.polygonRotating.radius > 50) {
      this.context.save();
      this.drawCentroid(this.polygonRotating);
      this.drawCentroidGuidewire(loc, this.polygonRotating);

      this.drawTrackingDial(this.polygonRotating);
      this.drawDegreeOuterDial(this.polygonRotating);
      this.context.fillStyle = 'rgba(100, 140, 230, 0.1)';
      this.context.fill();

      this.context.beginPath();
      this.drawDegreeOuterDial(this.polygonRotating);
      this.context.stroke();

      this.drawDegreeDialTicks(this.polygonRotating);
      this.drawDegreeTickDial(this.polygonRotating);
      this.drawDegreeAnnotations(this.polygonRotating);
      this.context.restore();
   }
},

redraw: function () {
   this.context.save();
   this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
   this.drawGrid('lightgray', 10, 10);
   this.drawPolygons();
   this.context.restore();
},

// Polygons......................................................

drawPolygon: function (polygon, angle) {
   var tx = polygon.x,
       ty = polygon.y;

   this.context.save();
   this.context.translate(tx, ty);

   if (angle) {
      this.context.rotate(angle);
   }

   polygon.x = 0;
   polygon.y = 0;

   polygon.stroke(this.context);

   if (this.fillCheckbox.checked) {
      polygon.fill(this.context);
   }

   this.context.restore();

   polygon.x = tx;
   polygon.y = ty;
},

getSelectedPolygon: function (loc) {
   for (var i=this.polygons.length-1; i >= 0; --i) {
      var polygon = this.polygons[i];

      polygon.createPath(this.context);
      if (this.context.isPointInPath(loc.x, loc.y)) {
         return polygon;
      }
   }
   return undefined;
},

stopRotatingPolygon: function (loc) {
   angle = Math.atan((loc.y - this.polygonRotating.y) /
                     (loc.x - this.polygonRotating.x))
                     - this.rotatingLockAngle;

   this.polygonRotating.startAngle += angle;

   this.polygonRotating = undefined;
   this.rotatingLockEngaged = false;
   this.rotatingLockAngle = 0;
},

startDragging: function (loc) {
   this.saveDrawingSurface();
   this.mousedown.x = loc.x;
   this.mousedown.y = loc.y;
   this.dragging = true; 
},

startEditing: function () {
   this.canvas.style.cursor = 'pointer';
   this.editing = true;
},

stopEditing: function () {
   this.canvas.style.cursor = 'crosshair';
   this.editing = false;
   this.polygonRotating = undefined;
   this.rotatingLockEngaged = false;
   this.rotatingLockAngle = 0;
   this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
   this.drawGrid('lightgray', 10, 10);
   this.drawPolygons();
}
};
