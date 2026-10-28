import path from 'node:path';

interface AngularVitestConfig {
  root?: string;
  test?: {
    include?: string[];
  };
}

export default {
  plugins: [
    {
      name: 'angular-relative-test-includes',
      config(config: AngularVitestConfig) {
        const include = config.test?.include;
        if (!include) {
          return undefined;
        }

        const root = config.root ?? process.cwd();
        return {
          test: {
            include: include.map(pattern => path.isAbsolute(pattern)
              ? path.relative(root, pattern).split(path.sep).join('/')
              : pattern)
          }
        };
      }
    }
  ]
};
