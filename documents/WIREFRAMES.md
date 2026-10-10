# Wireframes

*Text-based layout representations.*

## Current: Technician → Doctor → Patient workflow

### 1. Technician — Live Roster (`/technician`)
```text
+-----------------------------------------------------------+
| [Logo] RetinEx · Technician        [Bell] [Profile]        |
+-----------------------------------------------------------+
| Live Clinic Roster                    ( + Add New Patient )|
|                                                             |
| [ Waiting for Scan (4) ] [ AI Processing (1) ] [ Sent (12) ]|
|                                                             |
| +---------------------------------------------------------+|
| | Patient        Age  Phone         Status     Action     ||
| | Kamla Devi      54  98xxxxxx21    Waiting  ( Capture )  ||
| | Om Prakash      61  98xxxxxx09    Waiting  ( Capture )  ||
| +---------------------------------------------------------+|
+-----------------------------------------------------------+
```

### 2. Technician — Capture Scans (`/technician/patient/:patientId`)
```text
+-----------------------------------------------------------+
| < Back to Roster | Kamla Devi · Age 54                     |
+-----------------------------------------------------------+
|  +-------------------+     +-------------------+           |
|  |  Right Eye (OD)   |     |   Left Eye (OS)   |           |
|  |  [ drop image ]   |     |  [ drop image ]   |           |
|  +-------------------+     +-------------------+           |
|                                                             |
|  Assign Doctor: [ Dr. Ananya Singh v ]                      |
|                                                             |
|                                          (  Upload  )       |
+-----------------------------------------------------------+
```

### 3. Doctor — Today's Triage Queue (`/doctor`)
```text
+-----------------------------------------------------------+
| [Logo] RetinEx · Doctor              [Bell] [Profile]      |
+-----------------------------------------------------------+
| Today's Triage Queue                                       |
|                                                             |
| Patient       AI Grade        Referable    Action          |
| Om Prakash    Severe NPDR      [ Referable ] ( Analyze )    |
| Kamla Devi    Mild NPDR                     ( Analyze )    |
+-----------------------------------------------------------+
```

### 4. Doctor — Review Screen (`/doctor/review/:visitId`)
```text
+-----------------------------------------------------------+
| < Back to Queue | Om Prakash                                |
+-----------------------------------------------------------+
| [ OD: Grad-CAM overlay ]   [ OS: Grad-CAM overlay ]         |
| [ Microaneurysm channel ]  [ Microaneurysm channel ]        |
|                                                             |
| Clinical Notes: [ ...                                    ] |
| Prescription:   [ ...                                    ] |
| Dietary Advice: [ ...                    ] ( Auto-fill Demo)|
|                                                             |
| ( Agree with AI )  ( Override Grade )                      |
| (        Finalize & Push to Patient        )                |
+-----------------------------------------------------------+
```

### 5. Patient — Home (`/patient`)
```text
+-----------------------------------------------------------+
| [Logo] RetinEx · Patient           [Language v] [Profile]  |
+-----------------------------------------------------------+
| Welcome Back, Kamla                                        |
|                                                             |
| ( Registered ) -> ( Scans Uploaded ) -> ( Under Review )    |
|                                       -> ( Report Ready )   |
|                                                             |
| [ Go to Prescriptions -> ]                                  |
+-----------------------------------------------------------+
```

---

## Legacy: single-workstation dashboard (superseded)
These describe the earlier no-login, single-shared-workstation design.
Kept for reference against `FRONTEND_API_CONTRACT.md`'s captured
responses; not the current UI.

### Dashboard Layout
```text
+---------------------------------------------------------+
| [Logo] Retinex         Dashboard | Queue                | [User Profile] |
+---------------------------------------------------------+
|                                                         |
|  Welcome back, Priya Nair.                               |
|                                                         |
|  [ Upload Scan ]                                        |
|  Patient: [ dropdown ]   Eyes: [ OD ] [ OS ]  ( Upload ) |
|                                                         |
|  [ Metrics Row ]                                        |
|  +----------------+  +----------------+  +-----------+  |
|  | Pending Reviews|  | Scans Today    |  | High Risk |  |
|  |       12       |  |      45        |  |     3     |  |
|  +----------------+  +----------------+  +-----------+  |
|                                                         |
|  [ Recent Activity Feed ]                               |
|  - Kamla Devi's scan uploaded 5 mins ago.                |
|  - Om Prakash's report finalized 10 mins ago.            |
|                                                         |
|  [ Primary Action Button ]                              |
|  ( View Review Queue -> )                               |
+---------------------------------------------------------+
```

### Diagnostic Viewer Layout
```text
+---------------------------------------------------------+
| < Back to Queue | Patient: Om Prakash | MRN: #98765      |
+---------------------------------------------------------+
|                                      |                  |
|  [ Original Image Viewer ]           | [ AI Results ]   |
|                                      |                  |
|          +---------------+           | Severity: MILD   |
|          |               |           | Confidence: 87%  |
|          |   [ Retina    |           |                  |
|          |     Image ]   |           | [Toggle Heatmap] |
|          |               |           |                  |
|          +---------------+           | [AI Info Modal]  |
|                                      |                  |
|  Controls: (Zoom +) (Zoom -) (Reset) |                  |
|                                      |                  |
+--------------------------------------+------------------+
| [ Clinical Notes & Finalization ]                       |
|                                                         |
| Final Diagnosis: [ Dropdown: Mild NPDR v ]              |
| Notes: [ Text area...                                 ] |
|                                                         |
| ( Sign & Finalize )  ( Generate Report )                |
+---------------------------------------------------------+
```
