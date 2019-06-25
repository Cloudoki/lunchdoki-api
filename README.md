# Lunchdoki-API for Slack
API for Lunch picking

## API Description
#### Context
The purpose of this small project is to develop a service that can be used through Slack, to help us pick places to have lunch.

#### Use case
Lunch hour is getting close, someone goes to slack and:

- Triggers the service with the /lunch command
- It searches through Zomato's API which restaurantes are in the proximities (1km)
- Shows an interactive list to the users in slack and allows them to vote 
 
## How does it work?

API is triggered by typing the only existent command:

`/lunch [config][help] - Triggers the pool if a location is set`

### Parameters

Basic help information is showed if typed:

`/lunch help`

To trigger the pool a parameter must be called:

`/lunch config - Opens a dialog where you can manage all the available settings`

Config parameter contains the following settings:

- **Location Defined** - (optional) Let's a user define the location that's going to be used in the following polls
Until a new location is defined, every poll will be initialized with the same location;

- **Available Locations** - (optional) Allows a user to select an existent location previously inserted in the API and apply 
it to the next poll;

- **Result Count** - Changes the number of items listed in the poll;

- **Sorting** - Sorts the results by user prefence in terms of proximity, rating or cost

- **Average Cost** - Filters the shown results by the selected range of average cost;

- **Search** - A query field that helps getting more in-depth results (Optional); Can be used to obtain a specific type of restaurants. This parameter affects the whole API and must be used only inside of its context

## Features

- Ability to open inumerous customized polls and vote in each one.
- Total votes count displayed in real-time for each option
- Ability to change your vote and remove it.
- Each poll displays the address that match the typed location (Might not equal)
- Ability to check every item information in detail on Zomato by clicking on it's name (displayed in blue)
- Every option displayed is based on a range of 1km (but it does not mean that it's inside that range due to 
related implemetations)