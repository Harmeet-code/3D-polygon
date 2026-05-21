1. what is fabric units DONE
2. understand why are we converting fabric units to pixel units and then DONE
3. Converting pixel coordinates to 3D world space on the plane? DONE
4. what is floor plane? is it the 3D world? if yes then how will the image size related to the 3D world? DONE
5. ensure center at origin is correct. DONE
6. what is minX, minY, maxX, maxY and how are they related to fabric space DONE
7. why do we require baseScaleX/Y DONE
8. why di we need to do Offset + scale in fabricToPixel function DONE

9. split the code into 3 files DONE
10. change the slider to value based in calibration DONE
11. 3D plygons are being cut into 2 by the image plane. need to fix that DONE
12. how do i run window.AUDIT window.DEBUG DONE
13. DEBUG.showImageInfo() doesnt print any useful values DONE
    const IMG_H = floorTex.image.height; // 1600 pixels (vertical) DONE

14. ScaleX was 0.938 and ScaleY was 0.912 for all of the below values
    L1 series is the most aligned
    L1-16a,34a is slightly right for OffsetX 320
    L1-04,04b,09,10, 14,05,05A,15 is slightly right for OffsetX 320
    SD6 is correctly placed for OffsetX 318 and OffsetY 322
    SD1-10 are perfectly placed
    SW1-29 they are slightly left to what they need to be
    T1 is perfectly placed but T2,3,6 are above from there required position (they get placed right for ~400 OffsetY)
    T20,21 are below there corret position and are correctly placed OffsetX 290 OffsetY 183
    T44,45 is correctly placed for OffsetX 279 OffsetY 169
    P series is correctly placed for OffsetX 247 OffsetY 350
    NE series is correct for OffsetX 175 OffsetY 350
    A101-105,201-205,301-309,401-409,501-509,601-609,701-709,801-809,901-906,1001,1006,17-22,6-10 are correctly placed for OffsetX 169 OffsetY 359
    DONE
15. find the ifrmae for youtube-getYouTubeEmbedUrl() DONE
16. find the function for displaying info of both in the sidebar - Sidebar.js DONE
17. also check if color is hard coded in JSON or is it hard coded in JS or both DONE
18. is DUBUG not getting printed because of ' DONE
19. diff in booth type and booth color or the color is being set by the availability status as T26 is colored green while in JSON it is #ffc14e/orange - being set by availibility(status in JSON) DONE
20. buildBooths uses all above functions/concepts and init this step needs to be audited for accurarcy and also ensure center at origin is correct too // Step 5: Center geometry for accurate positioning DONE
21. need to check the dimensions of image from this function DONE
22. clicking on booth doesnt do anything ie doesnt zoom/focus, doesnt show youTube video, show tooltip, DONE
23. have size and booth number(from JSON) on top of polygon DONE
24. calibration vaues are not working properly. check with the debugging script and match the coordinates. check the image resolution if the hard coded values are correct or not. check the default scale and offset. map the console output and find which value are getting mismatched. DONE
25. check scaling might be wrong as some blocks are getting placed right while others are getting out like t1( it is also slightly left to what is should be) but t2 is out of the box DONE
    const IMG_W = floorTex.image.width; // 2400 pixels (horizontal)
26. and see if the calibration is correct for a portion of blocks or do we require diff calibration for diff block. DONE
27. change the color of booth DONE
28. add youtube link to JSON DONE
29. for below first check if the coordinates will be for 3d Three.js or pixel value or fabric/JSON DONE
30. add a coordinates adust debugging tool in sidebar for checking which values of booth are correct for correctly placed inside the image box DONE
31. scaleX/Y should adjust size and not change position for booths and check if when image needs to be scaled as well as polygons DONE
32. scaling is shifting and not changing size DONE
33. with the above also see if the polygonArea function is correctly finding the area and see why polygon on clockwise or anticlockwise matters and if it being Used to ensure consistent winding order is also correct or not. DONE
34. align all booths DONE
35. how would this be used for a multi story floor plan DONE
36. add hooks, prompts, instructions for copilot DONE
37. make sure that for diff JSON files(dynamically changing files) can be done without breaking DONE
38. make a 3D structure for entrance and stairs DONE
39. need to add a function like coordinate debug for adding staircase/entrnace with accurate fabric coordinates possibly a drag and drop or click in stair and then click in scene to place DONE
40. doors arent rotating DONE
41. check the routing algo for in-floor and between floor. add booth searching in path finding sidebar
    Your DenverFloorPlan.json stores fabricBBox per booth — a precomputed bounding box in fabric space. You're currently using it for... probably nothing, or maybe hit-testing.
    Here's the brain wave: Replace A\* pathfinding with fabricBBox rasterization.
    Your A* runs on a grid you generate by walking bounding boxes. But fabricBBox already gives you the occupied rectangles for every booth. You can build an occupancy grid in O(n) by scanline-rendering these boxes onto a binary grid — instead of doing A* node expansions that check each booth's polygon for collision.
    Worse: A* on a dense grid with 200 booths is O(n²) in practice because each path expansion checks against all booth polygons. Your route demo says "A* on grid + avoids booth bounding boxes" — but the current code re-validates against polygon geometry per step, which means it's doing point-in-polygon tests for every candidate node. Those polygon tests are doing cross-product math on 4+ vertices each time. At 10,000+ nodes explored, that's millions of floating-point operations for a single route.
    Pre-rasterize the bounding boxes once, and the pathfinder just reads a boolean array. 10x faster, zero polygon math. DONE
42. fix the coordinate debug tool DONE
43. in booth direction have the option to select floor and then only display booths of that floor DONE

44. display info for normal and heatmap which color means what
45. figure out what the high price/high price and sold and other combinations will e shown
46. add walkable area colored grey and use that for finding routes
47. understand the pathFinding functions and also figure out how the obstruction(booths are) and how to place a wall.
48. figure out from the 2D code how does it do multifloor and find path in multifloor. how is the JSON for multifloor.how to maintain state in multifloor.
49. current path finding algo sometimes goes through a block and can go around entire block of booths need to understand this
50. add color indicators for heatmap, check which color means what in heatmap
51. need to check if the staircase and entrance work fine with diff floors
52. need to fix show route for one floor and multifloor
53. need to check if i define a walkable zone which overlaps a booth what will happen then?
54.
