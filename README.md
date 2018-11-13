# Probe Request & MAC Randomisation Visualisation Suite

M.Sc Dissertation - The Visualisation & Analysis of Device Footprints Though 802.11 Probe Request Frames 
Grade - Distinction 79%

Probe requests not using MAC randomisation contain the sender’s MAC address and potentially a previously authenticated network SSID from the searching devices memory. Consequently devices are vulnerable to tracking. Current locations are determined through the presence of a broadcasted MAC address to a receiver and previously visited locations can, in theory, be determined based on the SSIDs contained within the frames. To address this issue, operating system patches have been written to randomise the senders MAC address broadcast within probe requests, in order to make device tracking less trivial. However, adoption of these fixes has been limited, and the success varied across device manufacturers. 

This suite was produced to graphically visualise the tracking concerns through cross-referencing contained SSIDs with wardriving WiFi databases, and demonstrated manufacturer patch success rates or failings. This ran on Pythons Flask web framework. The interactive GUI and data representations within the portal were built in JavaScript, making use of D3.js (Data Driven Documents), Crossfilter.js and DC.js. 

# Dataset Overview
![Overview Stats](/img/Home.png)
# Manufacturer Analysis
![Vendor Overview](/img/Vendor.png)
# SSID Analyis & Geolocation
![SSID Analysis](/img/SSID.png)
