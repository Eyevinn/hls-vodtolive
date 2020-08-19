global.reJSON = function reJSON(data) {
  return JSON.parse(JSON.stringify(data));
};

global.mockResponse = () => {
  const successMock = jest.fn(message => message);
  const errorMock = jest.fn(error => error);

  const jsend = {
    success: successMock,
    error: errorMock,
  };
  return {
    jsend,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
};
