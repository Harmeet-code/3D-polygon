1. what is fabric units    DONE
2. understand why are we converting fabric units to pixel units and then  DONE
3. Converting pixel coordinates to 3D world space on the plane?   DONE
4. what is floor plane? is it the 3D world? if yes then how will the image size related to the 3D world?     DONE
5. ensure center at origin is correct. DONE
6. what is minX, minY, maxX, maxY and how are they related to fabric space   DONE
7. why do we require baseScaleX/Y     DONE
8. why di we need to do Offset + scale in fabricToPixel function  DONE



10. split the code into 3 files  DONE
17. change the slider to value based in calibration    DONE
18. 3D plygons are being cut into 2 by the image plane. need to fix that   DONE
12. how do i run window.AUDIT window.DEBUG     DONE
13. DEBUG.showImageInfo() doesnt print any useful values   DONE
 const IMG_H = floorTex.image.height;  // 1600 pixels (vertical)          DONE

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
              DONE
21. find the ifrmae for youtube-getYouTubeEmbedUrl()       DONE
23. find the function for displaying info of both in the sidebar - Sidebar.js        DONE
24. also check if color is hard coded in JSON or is it hard coded in JS or both   DONE
29. is DUBUG not getting printed because of '   DONE
25. diff in booth type and booth color or the color is being set by the availability status as T26 is colored green while in JSON it is #ffc14e/orange - being set by availibility(status in JSON)   DONE
9. buildBooths uses all above functions/concepts and init this step needs to be audited for accurarcy and also ensure center at origin is correct too    // Step 5: Center geometry for accurate positioning        DONE
14. need to check the dimensions of image from this function  DONE
32. clicking on booth doesnt do anything ie doesnt zoom/focus, doesnt show youTube video, show tooltip,   DONE
22. have size and booth number(from JSON) on top of polygon   DONE



20. calibration vaues are not working properly. check with the debugging script and match the coordinates. check the image resolution if the hard coded values are correct or not. check the default scale and offset. map the console output and find which value are getting mismatched.   
11. check scaling might be wrong as some blocks are getting placed right while others are getting out like t1( it is also slightly left to what is should be)  but t2 is out of the box 
 const IMG_W = floorTex.image.width;   // 2400 pixels (horizontal)
16. and see if the calibration is correct for a portion of blocks or do we require diff calibration for diff block.
26. scaleX/Y should adjust size and not change position for booths and check if when image needs to be scaled as well as polygons
27. how would this be used for a multi story floor plan
28. make sure that for diff JSON files(dynamically changing files) can be done without breaking
30. add hooks, prompts, instructions for copilot
31. scaling is shifting and not changing size
33. display info for normal and heatmap which color means what 
34. figure out what the high price/high price and sold and other combinations will e shown
35. what is demoStatus function doing 
36. 
19. with the above also see if the polygonArea function is correctly finding the area and see why polygon on clockwise or anticlockwise matters and if it being Used to ensure consistent winding order is also correct or not.



ConsoleTools.js:89 Image Info
ConsoleTools.js:121 baseScale
: 
"1.093525, 1.103411"
calibration
: 
"offset 300, 300; scale 0.930, 0.920"
effectiveScale
: 
"1.016978, 1.015139"
fabric
: 
"10973.69 x 7949.89"
natural
: 
"12000 x 8772"
plane
: 
"140.00 x 102.34"
texture
: 
"12000 x 8772"
ConsoleTools.js:130 Raw info object: baseScale
: 
x
: 
1.0935246029366603
y
: 
1.1034114937439385
[[Prototype]]
: 
Object
calibration
: 
offsetX
: 
300
offsetY
: 
300
scaleX
: 
0.93
scaleY
: 
0.92
[[Prototype]]
: 
Object
effectiveScale
: 
{x: 1.016977880731094, y: 1.0151385742444234}
fabricBounds
: 
height
: 
7949.89
maxX
: 
11390.02
maxY
: 
8318.84
minX
: 
416.33
minY
: 
368.95
width
: 
10973.69
[[Prototype]]
: 
Object
imageAspect
: 
1.3679890560875514
imageFile
: 
"DenverFloorPlan1.jpg"
naturalHeight
: 
8772
naturalWidth
: 
12000
planeAspect
: 
1.3679890560875512
planeHeight
: 
102.34
planeWidth
: 
140
rendererCanvas
: 
cssHeight
: 
768
cssWidth
: 
1052
devicePixelRatio
: 
1
height
: 
768
width
: 
1052
[[Prototype]]
: 
Object
textureHeight
: 
8772
textureWidth
: 
12000
ConsoleTools.js:131 IMG_W / IMG_H from code: ObjectIMG_H: 8772IMG_W: 12000[[Prototype]]: Object
ConsoleTools.js:55 Transform Pipeline: P18 [8234.475, 2365.12]
ConsoleTools.js:56 Fabric Coords (from JSON): Array(2)0: 8234.4751: 2365.12length: 2[[Prototype]]: Array(0)
ConsoleTools.js:58 Pixel Coords: Objectpx: 8250.8805333484py: 2326.3891677494903[[Prototype]]: Object (image is 12000x8772)
ConsoleTools.js:60 World Coords: Objectx: 26.26027288906466z: 24.028793042922615[[Prototype]]: Object (plane is 140.0x102.3)
ConsoleTools.js:65 Calibration values: ObjectoffsetX: 300offsetY: 300scaleX: 0.93scaleY: 0.92[[Prototype]]: Object
ConsoleTools.js:24 Booth P18 Polygon Check
ConsoleTools.js:25 Points: Array(4)0: (2) [8234.475, 2365.12]1: (2) [8443.045, 2365.12]2: (2) [8443.045, 2538.98]3: (2) [8234.475, 2538.98]length: 4[[Prototype]]: Array(0)
ConsoleTools.js:26 BBox from JSON: Objecth: 173.86w: 208.57x: 8234.475y: 2365.12[[Prototype]]: Object
ConsoleTools.js:39 Calculated: Objecth: 173.86000000000013maxX: 8443.045maxY: 2538.98minX: 8234.475minY: 2365.12w: 208.5699999999997[[Prototype]]: Object
ConsoleTools.js:41 BBox matches! Polygon is valid.
ConsoleTools.js:70 Multi-Booth Comparison
ConsoleTools.js:77 P18: fabric[8234.475,2365.12] pixel[8251,2326] world[26.26,24.03]
ConsoleTools.js:77 P19: fabric[8231.87,2546.76] pixel[8248,2511] world[26.23,21.88]
ConsoleTools.js:77 P66: fabric[8445.835,2589.82] pixel[8466,2554] world[28.77,21.37]
ConsoleTools.js:77 NE4: fabric[10165.265,852.55] pixel[10214,791] world[49.17,41.94]
ConsoleTools.js:403 COMPLETE COORDINATE SYSTEM AUDIT
ConsoleTools.js:247 Floor Plane Audit
ConsoleTools.js:248 Plane dimensions: ObjectaspectRatio: "1.368"height: 102.34width: 140[[Prototype]]: Object
ConsoleTools.js:253 Image info: Objectheight: 8772width: 12000[[Prototype]]: Object
ConsoleTools.js:254 Position: Objectx: 0y: 0z: 0[[Prototype]]: Object
ConsoleTools.js:255 Geometry extent (from vertices):
ConsoleTools.js:260   min: Objectx: "-70.00"y: "-51.17"z: "0.00"[[Prototype]]: Object
ConsoleTools.js:265   max: Objectx: "70.00"y: "51.17"z: "0.00"[[Prototype]]: Object
ConsoleTools.js:270   center: Object
ConsoleTools.js:275 Floor plane is centered at origin
ConsoleTools.js:280 Coordinate Transform Audit
ConsoleTools.js:281 Scaling factors: ObjectbaseScaleX: "1.093525"baseScaleY: "1.103411"[[Prototype]]: Object
ConsoleTools.js:285 Fabric bounds: Objectheight: "7949.89"maxX: 11390.02maxY: 8318.84minX: 416.33minY: 368.95width: "10973.69"[[Prototype]]: Object
ConsoleTools.js:293 Image dimensions: Objectheight: 8772width: 12000[[Prototype]]: Object
ConsoleTools.js:294 Scale calculation verify:
ConsoleTools.js:295   12000 / 10973.69 = 1.093525
ConsoleTools.js:298   8772 / 7949.89 = 1.103411
ConsoleTools.js:344 All Booth Centering Audit
ConsoleTools.js:359 All 419 booths are centered on X/Z and sit above the floor plane
ConsoleTools.js:366 Winding Order Audit
ConsoleTools.js:395 All 419 booths maintain consistent winding order
ConsoleTools.js:408 All systems nominal!
ConsoleTools.js:409 Try: AUDIT.auditBoothTransformation('P18')
ConsoleTools.js:310 Booth Transformation Audit: P18
ConsoleTools.js:315   Corner 1
ConsoleTools.js:316 Fabric:  [8234.48, 2365.12]
ConsoleTools.js:317 Pixel:   [8250.9, 2326.4]
ConsoleTools.js:318 World:   [26.260, 24.029]
ConsoleTools.js:315   Corner 2
ConsoleTools.js:316 Fabric:  [8443.05, 2365.12]
ConsoleTools.js:317 Pixel:   [8463.0, 2326.4]
ConsoleTools.js:318 World:   [28.735, 24.029]
ConsoleTools.js:315   Corner 3
ConsoleTools.js:316 Fabric:  [8443.05, 2538.98]
ConsoleTools.js:317 Pixel:   [8463.0, 2502.9]
ConsoleTools.js:318 World:   [28.735, 21.970]
ConsoleTools.js:315   Corner 4
ConsoleTools.js:316 Fabric:  [8234.48, 2538.98]
ConsoleTools.js:317 Pixel:   [8250.9, 2502.9]
ConsoleTools.js:318 World:   [26.260, 21.970]
ConsoleTools.js:324 Mesh in scene:
ConsoleTools.js:325   Position: [27.498, 0.000, -22.999]
ConsoleTools.js:329   Stored center: [27.498, 0.100, -22.999]
ConsoleTools.js:335   Geometry X/Z center: [0.0000, 0.0000]
ConsoleTools.js:338   Geometry Y extent: [0.0000, 2.0000]
ConsoleTools.js:413 DEBUG UTILITIES
[object Object]
undefined
undefined
undefined
AUDIT UTILITIES
undefined
undefined
