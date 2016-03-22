
// overriding product schema with extended version
ReactionCore.Schemas.Product = new SimpleSchema([
  ReactionCore.Schemas.Product, {
    "forSaleOnDate": {
      type: Date,
      defaultValue: new Date,
      /*
      autoValue: function () { // BAD BAD BAD auto value!! not the same as a default value!
        return new Date;
      },*/
      optional: false
    },
  }
]);