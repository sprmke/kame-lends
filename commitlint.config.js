export default {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'scope-enum': [2, 'always', ['ui', 'api', 'database', 'docs', 'deps', 'sveltekit']]
	}
};
