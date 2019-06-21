module.exports = {
	keys: {
		zomato: {
			doc: 'Zomato API Key',
			format: String,
			default: '',
			env: 'LUNCHDOKI_ZOMATO_KEY',
		},
		gmaps: {
			doc: 'Google Maps GeoLocation Key',
			format: String,
			default: '',
			env: 'LUNCHDOKI_GMAPS_KEY',
		},
		slack: {
			key: {
				doc: 'Slack Access Key',
				format: String,
				default: '',
				env: 'LUNCHDOKI_SLACK_KEY',
			},
			client_id: {
				doc: 'Slack Client ID',
				format: String,
				default: '',
				env: 'LUNCHDOKI_SLACK_CID',
			},
			client_secret: {
				doc: 'Slack Client Secret',
				format: String,
				default: '',
				env: 'LUNCHDOKI_SLACK_CS',
			},
		},
	},
	db: {
		doc: 'Mongoose DB Connection',
		format: String,
		default: 'mongodb+srv://marco:cloudoki@mernshopping-4iafj.azure.mongodb.net/test?retryWrites=true',
		env: 'LUNCHDOKI_API_DB',
	},
	port: {
		doc: 'Server Port',
		format: 'port',
		default: 3000,
		env: 'LUNCHDOKI_API_PORT',
	},
	pino: {
		config: {
			name: {
				doc: 'API logger name',
				format: String,
				default: 'FOODOKI_API',
			},
			level: {
				doc: 'Logger level',
				format: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
				env: 'LUNCHDOKI_API_LOG_LEVEL',
				default: 'trace',
			},
		},
		pretty: true,
	},
}
