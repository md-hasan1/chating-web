const config = {
  jwt: {
    jwt_secret: process.env.JWT_SECRET || 'secret',
  },
};

export default config;
