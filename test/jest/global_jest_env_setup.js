/* global jest */
// sets global async timeout
jest.setTimeout(60000);

// get global mock project path and set it to a global
global.__mock_project_path = process.env.GLOBAL_MOCK_PROJECT_PATH;
