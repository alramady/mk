# Buildings & Units
> Last updated: 2026-02-27

This guide provides instructions for managing buildings and units within the Monthly Key platform. Proper management of buildings and units is crucial for maintaining accurate inventory and ensuring seamless integration with our channel manager, Beds24.

## 1. Managing Buildings

Buildings are the primary containers for your rental units. All units must belong to a building.

### Creating a New Building

Only users with the **Admin** role can create new buildings.

1.  Navigate to the **Buildings** module from the main menu.
2.  Click the **+ New Building** button.
3.  Fill in the required building details in the form that appears.

| Field | Description | Role Access |
| --- | --- | --- |
| **Building Name** | The official name of the building (e.g., "Jeddah Tower A"). | Admin, Ops |
| **Address** | The full physical address of the building. | Admin, Ops |
| **Amenities** | A list of available amenities (e.g., Gym, Pool). | Admin, Ops |

4.  Click **Save** to create the building. It will now appear in the buildings list.

### Editing a Building

Operational details can be updated as needed by authorized staff.

1.  Go to the **Buildings** module.
2.  Find the building you wish to edit and click the **Edit** icon.
3.  Modify the necessary fields.
4.  Click **Save** to apply the changes.

### Archiving a Building

Archiving a building will remove it from the active list and make all its units unavailable. This action is reserved for buildings that are no longer part of the Monthly Key portfolio. This action can only be performed by an **Admin**.

1.  From the **Buildings** list, click the **Archive** icon next to the relevant building.
2.  A confirmation dialog will appear. Confirm the action to proceed.
3.  The building and all its associated units will be archived.

> **Note:** Archiving is a permanent action. To reactivate a building, you must contact technical support.

## 2. Managing Units

Units are the individual rentable spaces within a building. Each unit has its own status, pricing, and mapping settings.

### Adding Units to a Building

1.  Navigate to the **Buildings** module and select the building where you want to add units.
2.  Click on the **Units** tab.
3.  Click the **+ Add Unit** button.
4.  Enter the unit details.

| Field | Description | Role Access |
| --- | --- | --- |
| **Unit Number** | The unique identifier for the unit (e.g., 101, G-05). | Admin, Ops |
| **Type** | The type of unit (e.g., Studio, 1-Bedroom). | Admin, Ops |
| **Beds24 Room ID** | The corresponding Room ID from Beds24. | Admin |

5.  Click **Save**. The new unit will be created with the default status of **AVAILABLE**.

### Editing a Unit

1.  Select the building and go to the **Units** tab.
2.  Find the unit you need to modify and click the **Edit** icon.
3.  Update the details as required and click **Save**.

### Unit Statuses

Each unit has a status that determines its availability for booking. This status is managed internally and does not sync directly with Beds24's availability.

| Status | Description | Impact |
| --- | --- | --- |
| **AVAILABLE** | The unit is ready for booking. | Appears in search results for local bookings. |
| **BLOCKED** | The unit is temporarily unavailable for non-maintenance reasons. | Removed from booking availability. |
| **MAINTENANCE** | The unit is undergoing maintenance and cannot be booked. | Removed from availability; maintenance notifications may be triggered. |

To change a unit's status:
1.  Go to the unit's detail page.
2.  Select the new status from the dropdown menu.
3.  Click **Update Status**. The change will be logged in the unit's history.

### Mapping Units to Beds24

Mapping a unit to Beds24 links it to the corresponding room in the channel manager. This is a critical step for ensuring that availability and bookings are synchronized correctly. Only **Admins** can manage Beds24 mapping.

> **Important:** For mapped units, **Beds24 is the source of truth** for availability. Local status changes will not override the availability set in Beds24.

To map a unit:
1.  During unit creation or editing, enter the correct **Beds24 Room ID**.
2.  Ensure the ID is an exact match to the one in Beds24.
3.  Save the unit.

The system will now pull booking and availability data from Beds24 for this unit. The platform will never write changes back to Beds24 to prevent accidental overrides.

## FAQ

**1. What happens if I don't map a unit to Beds24?**
If a unit is not mapped, it can only be managed and booked locally through the Monthly Key platform. It will not be visible on any external booking channels connected via Beds24.

**2. How do I handle a long-term maintenance issue for a unit?**
Set the unit's status to **MAINTENANCE**. This will make it unavailable for booking and allows the operations team to track the work. Add a note in the unit's log to describe the issue and expected resolution date.

**3. Can an Ops user change the Beds24 Room ID?**
No, only users with the **Admin** role can modify the Beds24 mapping to prevent synchronization errors. Please see `../en/01-roles-permissions.md` for more details on role capabilities.

**4. Why is a unit showing as booked on the platform but available on Beds24?**
This can happen if a local booking was created for an unmapped unit. Ensure all units intended for channel distribution are correctly mapped. For mapped units, the booking source should be listed as `BEDS24`. If it's `LOCAL`, it indicates a direct booking was made, which does not sync to the channel manager.

**5. What is the difference between `BLOCKED` and `MAINTENANCE` status?**
`BLOCKED` is a general-purpose status to make a unit temporarily unavailable (e.g., owner stay, pending deep cleaning). `MAINTENANCE` is specifically for tracking units that are out of service for repairs or upgrades and may trigger specific workflows for the operations team.

---

*For more information on related topics, please see:* `../en/04-bookings-occupancy.md`
