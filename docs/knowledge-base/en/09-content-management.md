> Last updated: 2026-02-27

# Content Management

This guide provides instructions for managing content on the Monthly Key platform. It covers editing property listings, managing images, updating site settings, and handling the FAQ section. All staff members with `admin` or `ops` roles can perform these actions.

## Property Listings

Property listings are the core of our platform. Keeping them accurate and up-to-date is crucial for attracting and retaining customers. Listings are managed in the **Buildings/Units** module.

### Editing a Property

To edit an existing property, follow these steps:

1.  Navigate to the **Buildings/Units** module.
2.  Find the property you want to edit using the search or filter functions.
3.  Click the **Edit** button next to the property name.
4.  Update the necessary fields, such as the property description, amenities, or rental rates.
5.  Click **Save** to apply the changes.

| Field | Description | Role Access |
| --- | --- | --- |
| **Building Name** | The official name of the building. | `admin`, `ops` |
| **Address** | The full address of the property. | `admin`, `ops` |
| **Description** | A detailed description of the property and its features. | `admin`, `ops` |
| **Amenities** | A list of available amenities (e.g., Wi-Fi, parking, gym). | `admin`, `ops` |

### Unit Status

Each unit within a building has a status that reflects its availability. The status can be updated from the unit's detail page.

| Status | Description |
| --- | --- |
| **AVAILABLE** | The unit is available for booking. |
| **BLOCKED** | The unit is temporarily unavailable for booking. |
| **MAINTENANCE** | The unit is under maintenance and cannot be booked. |

For units mapped to Beds24, status changes may need to be coordinated with the Beds24 platform. Please refer to the [Beds24 Integration](../en/05-beds24-integration.md) guide for more details.

## Image Management

High-quality images are essential for showcasing our properties. Images can be uploaded and managed for each property listing.

### Uploading Images

1.  From the property's edit page, go to the **Images** tab.
2.  Click the **Upload Images** button.
3.  Select the image files from your computer. You can upload multiple images at once.
4.  The images will be automatically resized and optimized for the web.

### Managing Images

-   **Set as main image:** Choose the primary image that will be displayed in search results.
-   **Reorder images:** Drag and drop images to change their display order.
-   **Delete images:** Remove outdated or low-quality images.

## Site Settings

Site settings allow `admin` users to configure global aspects of the platform. These settings are located in the **Settings** module.

| Setting | Description | Role Access |
| --- | --- | --- |
| **Site Title** | The title that appears in the browser tab. | `admin` |
| **Contact Email** | The primary email address for customer inquiries. | `admin` |
| **Social Media Links** | Links to our social media profiles. | `admin` |

## FAQ Management

The FAQ section helps customers find answers to common questions. It can be managed from the **FAQ** module.

### Adding a New FAQ

1.  Navigate to the **FAQ** module.
2.  Click the **Add New** button.
3.  Enter the question and its corresponding answer.
4.  Click **Save** to add the new FAQ to the website.

### Editing or Deleting an FAQ

-   To **edit**, click the **Edit** button next to the FAQ you want to change.
-   To **delete**, click the **Delete** button.

## FAQ

**Q1: How do I change the main image for a property?**

A1: From the property's edit page, go to the **Images** tab and click the "Set as main image" button on the desired image.

**Q2: Can I schedule a unit to become available on a future date?**

A2: The system does not currently support scheduled status changes. You will need to manually change the unit status from **BLOCKED** or **MAINTENANCE** to **AVAILABLE** on the desired date.

**Q3: Who can update the site settings?**

A3: Only users with the `admin` role can access and modify the site settings.

---

*For more information on related topics, please see:*

-   [Beds24 Integration](../en/05-beds24-integration.md)
-   [Roles and Permissions](../en/01-roles-permissions.md)
