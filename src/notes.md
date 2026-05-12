standard structure of JSON
```json
{
  "meta": {
    "image": "DenverFloorPlan1.jpg",
    "fabricBounds": {
      "minX": 416.33,
      "minY": 368.95,
      "maxX": 11390.02,
      "maxY": 8318.84
    },
    "mapping": {
      "offsetX": 0,
      "offsetY": 0,
      "scaleX": 1,
      "scaleY": 1
    }
  },
  "booths": [
    {
      "boothNo": "L1-15",
      "price": "1800.00",
      "size": "10x10",
      "boothType": "Yellow",
      "boothColor": "#ffef47",
      "gatePosition": "Top",
      "status": "AVAILABLE",
      "company": null,
      "geometry": {
        "type": "polygon",
        "points": [
          [
            5636.27,
            5366.78
          ],
          [
            5821.97,
            5366.78
          ],
          [
            5821.97,
            5478.2
          ],
          [
            5636.27,
            5478.2
          ]
        ]
      },
      "fabricBBox": {
        "x": 5636.27,
        "y": 5366.78,
        "w": 185.7,
        "h": 111.42
      }
    }
  ]
}
    ```
what is fabric units
understand why are we converting fabric units to pixel units and then Converting pixel coordinates to 3D world space on the plane?
what is floor plane? is it the 3D world? if yes then how will the image size related to the 3D world?
ensure center at origin is correct.

what is minX, minY, maxX, maxY and how are they related to fabric space
why do we require baseScaleX/Y
why di we need to do Offset + scale in fabricToPixel function


buildBooths uses all above functions/concepts and init this step needs to be audited for accurarcy and also ensure center at origin is correct too    // Step 5: Center geometry for accurate positioning 

split the code into 3 files

with the above also see if the polygonArea function is correctly finding the area and see why polygon on clockwise or anticlockwise matters and if it being Used to ensure consistent winding order is also correct or not.

    calibration vaues are not working properly. check with the debugging script and match the coordinates. check the image resolution if the hard coded values are correct or not. check the default scale and offset. map the console output and find which value are getting mismatched. 
    and see if the calibration is correct for a portion of blocks or do we require diff calibration for diff block.