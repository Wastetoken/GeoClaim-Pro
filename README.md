# GeoClaim PRO

**GeoClaim PRO** is a high-fidelity geospatial intelligence platform designed for mineral prospectors, geological engineers, and historical researchers. It transforms fragmented data from sources like Mindat.org and the Paleobiology Database into a tactical, real-time command center for field exploration.

## Core Capabilities

### 1. Unified Cartographic Stack
Provides a "peel-back" interface using professional-grade GIS overlays:
*   **Macrostrat Geology:** Visualizes rock units, ages, and lithology to identify geological contacts and outcrops.
*   **BLM Land Status:** Real-time land management status (Bureau of Land Management, Private, or Federal) to ensure legal field access.
*   **Historic Satellite Imagery:** Comparison tools for 19th-century mining footprints vs. modern terrain.
*   **High-Resolution Topography:** Integrated USGS Topo and OpenTopoMap layers for precision terrain analysis.

### 2. Mindat Fidelity Mapping
The platform precisely maps the professional hierarchy of the Mindat database, using specific color-coded iconography to distinguish between:
*   **Mines (Red Hammer):** Sites with significant historical or active production.
*   **Prospects (Orange Pick):** Significant workings where exploration occurred without recorded major production.
*   **Occurrences (Yellow Star):** Known mineral locations with minimal physical work or discovery-only status.
*   **Facilities (Blue Gear):** Smelters, mills, processing plants, and other mineral-industrial facilities.

### 3. AI-Powered "Audit Log"
A dedicated **Gemini-powered Geological Intelligence Terminal** with Google Search grounding:
*   Search **BLM MLRS records** for active mining claim status and ownership.
*   Retrieve **historical production data** and USGS technical bulletins.
*   Synthesize **district lore** and ownership history for specific localities using real-time web grounding.

### 4. Intelligence Hub (Field Essentials)
Dynamic, multi-tabbed reporting generated for every selected locality:
*   **Registry:** Identifies minerals/fossils at the site with integrated imagery from a geospatial specimen registry.
*   **Safety & Logistics:** Live hazard analysis (shafts, rattlesnakes, flash floods) and **Nearest Trauma Center** identification via GPS proximity.
*   **Weather:** Site-specific field windows (optimal visit months) and real-time condition reports.
*   **Media Gallery:** Curated **YouTube scouting** (Urbex, drone surveys, mineral vlogs) tied to the exact site coordinates for visual reconnaissance.

### 5. Advanced Metrology
*   **Spatial Geodesy:** High-precision Latitude and Longitude tracking.
*   **Elevation Mapping:** Real-time MSL (Mean Sea Level) data via Open Elevation API for ingress/egress planning and grade calculation.

## Technical Specifications
*   **Framework:** React 19 (ES6 Modules)
*   **Intelligence:** Google Gemini API (Search Grounding & Structured JSON output)
*   **Mapping Engine:** Leaflet.js with optimized Marker Clustering for datasets exceeding 1,000 nodes.
*   **Styling:** Tailwind CSS with a "High-Contrast Stealth" theme.
*   **Data Source:** Remote KML parsing with recursive metadata extraction.