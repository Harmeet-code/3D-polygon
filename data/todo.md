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
20. calibration vaues are not working properly. check with the debugging script and match the coordinates. check the image resolution if the hard coded values are correct or not. check the default scale and offset. map the console output and find which value are getting mismatched.      DONE
11. check scaling might be wrong as some blocks are getting placed right while others are getting out like t1( it is also slightly left to what is should be)  but t2 is out of the box   DONE
 const IMG_W = floorTex.image.width;   // 2400 pixels (horizontal)
16. and see if the calibration is correct for a portion of blocks or do we require diff calibration for diff block.   DONE
37. change the color of booth   DONE
36. add youtube link to JSON     DONE



26. scaleX/Y should adjust size and not change position for booths and check if when image needs to be scaled as well as polygons
27. how would this be used for a multi story floor plan
28. make sure that for diff JSON files(dynamically changing files) can be done without breaking
30. add hooks, prompts, instructions for copilot
31. scaling is shifting and not changing size
33. display info for normal and heatmap which color means what 
34. figure out what the high price/high price and sold and other combinations will e shown
35. 
39. for below first check if the coordinates will be for 3d Three.js or pixel value or fabric/JSON
38. add a coordinates adust debugging tool in sidebar for checking which values of booth are correct for correctly placed inside the image box
19. with the above also see if the polygonArea function is correctly finding the area and see why polygon on clockwise or anticlockwise matters and if it being Used to ensure consistent winding order is also correct or not.
39. add walkable area colored grey and use that for finding routes
40. also check resizing the image for future diff floor plans
41. align all booths, 





Here's the recommended workflow:
First — get calibration right globally. The 4 calibration values affect ALL booths. If those are wrong, the fabric coordinates you generate will be compensating for bad calibration, not reflecting real geometry. Use the debug tool to check a few reference booths that you know should be placed correctly.
Then — tweak individual booths without touching calibration:
1. Select a booth in the debug dropdown
2. Check its World X,Z values — does it look right in the 3D scene?
3. If not, edit the World X,Z fields — the cyan overlay shows the new position live
4. Click Apply — this reverse-calculates the correct fabric coordinates and rebuilds the mesh
5. Move to the next booth
Don't reset calibration between booths — that would break every other booth you've already fixed. Calibration is a one-time setup. Only reset calibration if you're starting over or if you notice all booths are systematically shifted in the same direction.
One gotcha: after clicking Apply, the fabric coordinates are updated in memory but NOT saved to the JSON file. You need to click Copy JSON and paste the output into booths_poly_v2.json to persist your changes.