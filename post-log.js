const { default: axios } = require("axios");

module.exports = async (cid, message_object) => {
  try {
    axios.post("http://localhost:3003/", {
      msg: message_object,
      channel_id: cid,
    });
  } catch (error) {
    console.log(error);
  }
};
