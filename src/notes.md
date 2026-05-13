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
1. what is fabric units    DONE
2. understand why are we converting fabric units to pixel units and then  DONE
3. Converting pixel coordinates to 3D world space on the plane?   DONE
4. what is floor plane? is it the 3D world? if yes then how will the image size related to the 3D world?     DONE
5. ensure center at origin is correct. DONE
6. what is minX, minY, maxX, maxY and how are they related to fabric space   DONE
7. why do we require baseScaleX/Y     DONE
8. why di we need to do Offset + scale in fabricToPixel function  DONE


9. buildBooths uses all above functions/concepts and init this step needs to be audited for accurarcy and also ensure center at origin is correct too    // Step 5: Center geometry for accurate positioning 

10. split the code into 3 files  DONE

11. check scaling might be wrong as some blocks are getting placed right while others are getting out like t1( it is also slightly left to what is should be)  but t2 is out of the box 
12. how do i run window.AUDIT window.DEBUG
13. DEBUG.showImageInfo() doesnt print any useful values
14. need to check the dimensions of image from this function
 const IMG_W = floorTex.image.width;   // 2400 pixels (horizontal)
 const IMG_H = floorTex.image.height;  // 1600 pixels (vertical)

17. change the slider to value based in calibration    DONE

18. 3D plygons are being cut into 2 by the image plane. need to fix that

19. with the above also see if the polygonArea function is correctly finding the area and see why polygon on clockwise or anticlockwise matters and if it being Used to ensure consistent winding order is also correct or not.

20. calibration vaues are not working properly. check with the debugging script and match the coordinates. check the image resolution if the hard coded values are correct or not. check the default scale and offset. map the console output and find which value are getting mismatched. 
16. and see if the calibration is correct for a portion of blocks or do we require diff calibration for diff block.

15.  
ScaleX was 0.938 and ScaleY was 0.912 for all of the below values
L1 series is the most aligned 
L1-16a,34a is slightly right for OffsetX 320
L1-04,04b,09,10, 14,05,05A,15 is slightly right for OffsetX 320
SD6 is correctly placed for OffsetX 318 and OffsetY 322 
SD1-10 are perfectly placed
SW1-29 they are slightly left to what they need to be 
T1 is perfectly placed but T2,3,6 are above from there required position (they get placed right for ~400 OffsetY)
T20,21 are below there corret position and are correctly placed OffsetX  290 OffsetY 183
T44,45 is correctly placed for OffsetX 279 OffsetY 169
P series is correctly placed for OffsetX 247 OffsetY 350
NE series is correct for OffsetX 175 OffsetY 350
A101-105,201-205,301-309,401-409,501-509,601-609,701-709,801-809,901-906,1001,1006,17-22,6-10 are correctly placed for OffsetX 169 OffsetY 359

21. find the ifrmae for youtube-getYouTubeEmbedUrl()
22. have size and booth number on top of polygon
23. find the function for displaying info of both in the sidebar
24. also check if color is hard coded in JSON or is it hard coded in JS or both
25. diff in booth type and booth color or the color is being set by the availability status as T26 is colored green while in JSON it is #ffc14e/orange
26. scaleX/Y should adjust size and not change position
27. how would this be used for a multi story floor plan
28. make sure that for diff JSON files(dynamically changing files) can be done without breaking
29. 