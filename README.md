# Lunchdoki-API 
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

Config paramter contains the following settings:

- **Location Defined** - (optional) Let's a user define the location that's going to be used in the following polls
Until a new location is defined, every poll will be initialized with the same location;

- **Available Locations** - (optional) Allows a user to select an existent location previously inserted in the API and apply 
it to the next poll;

- **Result Count** - Changes the number of items listed in the poll;

- **Prefered Cuisines** - Filters the show results by cuisine (Limited);

- **Average Cost** - Filters the shown results by the selected range of average cost;

