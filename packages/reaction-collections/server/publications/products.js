//
// define search filters as a schema so we can validate
// params supplied to the products publication
//
const filters = new SimpleSchema({
  "shops": {
    type: [String],
    optional: true
  },
  "tags": {
    type: [String],
    optional: true
  },
  "forSaleOnDate": {
    type: Date,
    optional: true
  },
  "location": {
    type: String,
    optional: true
  },
  "query": {
    type: String,
    optional: true
  },
  "visibility": {
    type: Boolean,
    optional: true
  },
  "details": {
    type: Object,
    optional: true
  },
  "details.key": {
    type: String,
    optional: true
  },
  "details.value": {
    type: String,
    optional: true
  },
  "price": {
    type: Object,
    optional: true
  },
  "price.min": {
    type: String,
    optional: true
  },
  "price.max": {
    type: String,
    optional: true
  },
  "weight": {
    type: Object,
    optional: true
  },
  "weight.min": {
    type: String,
    optional: true
  },
  "weight.max": {
    type: String,
    optional: true
  }
});

/**
 * products publication
 * @param {Number} productScrollLimit - optional, defaults to 24
 * @param {Array} shops - array of shopId to retrieve product from.
 * @return {Object} return product cursor
 */
Meteor.publish("Products", function (productScrollLimit = 24, productFilters, sort = {}) {
  check(productScrollLimit, Number);
  check(productFilters, Match.OneOf(undefined, filters, Date));

  let shopAdmin;
  const shop = ReactionCore.getCurrentShop();
  const Products = ReactionCore.Collections.Products;

  if (typeof shop !== "object") {
    return this.ready();
  }

  if (shop) {
    let selector = {
      ancestors: { $exists: true, $eq: [] },
      shopId: shop._id
    };

    if (productFilters) {
      // handle multiple shops
      if (productFilters.shops) {
        _.extend(selector, {
          shopId: {
            $in: productFilters.shops
          }
        });

        // check if this user is a shopAdmin
        for (let thisShopId of productFilters.shops) {
          if (Roles.userIsInRole(this.userId, ["admin", "createProduct"], thisShopId)) {
            shopAdmin = true;
          }
        }
      }

      // filter by tags
      if (productFilters.tags) {
        _.extend(selector, {
          hashtags: {
            $in: productFilters.tags
          }
        });
      }

      // filter by date
      if (productFilters.forSaleOnDate) {
        let basicDate = moment(new Date(productFilters.forSaleOnDate)).format('YYYY-MM-DD');
        ReactionCore.Log.info("filtering products by date: ",basicDate, " ",new Date(basicDate+"T00:00:00.000Z")," ",new Date(basicDate+"T23:59:59.000Z"));

        _.extend(selector, {
          forSaleOnDate: {
            "$gte": new Date(basicDate+"T00:00:00.000Z"),
            "$lte": new Date(basicDate+"T23:59:59.000Z")
          }
        });
      }

      // filter by location
      if (productFilters.location) {
        ReactionCore.Log.info("filtering products by location: ",productFilters.location);
        let filterLocation = productFilters.location.split("/");

        let usersSelector = {
          "profile.latitude": parseFloat(filterLocation[0]),
          "profile.longitude": parseFloat(filterLocation[1])
        };
        ReactionCore.Log.info("with selector: ",usersSelector);
        let usersForLocation = Meteor.users.find(
          usersSelector
        );

        let userIds = usersForLocation.map(function(p)
          {
            ReactionCore.Log.info("map user: ",p);
            return p._id
          }
        );
        ReactionCore.Log.info("found users for lat/long: ",userIds);

        _.extend(selector, {
          userId: {
            "$in": userIds,
          }
        });
      }

      // filter by query
      if (productFilters.query) {
        let cond = {
          $regex: productFilters.query,
          $options: "i"
        };
        _.extend(selector, {
          $or: [{
            title: cond
          }, {
            pageTitle: cond
          }, {
            description: cond
          }]
        });
      }

      // filter by details
      if (productFilters.details) {
        _.extend(selector, {
          metafields: {
            $elemMatch: {
              key: {
                $regex: productFilters.details.key,
                $options: "i"
              },
              value: {
                $regex: productFilters.details.value,
                $options: "i"
              }
            }
          }
        });
      }

      // filter by visibility
      if (productFilters.visibility !== undefined) {
        _.extend(selector, {
          isVisible: productFilters.visibility
        });
      }

      // filter by gte minimum price
      if (productFilters["price.min"] && !productFilters["price.max"]) {
        _.extend(selector, {
          "price.min": {
            $gte: parseFloat(productFilters["price.min"])
          }
        });
      }

      // filter by lte maximum price
      if (productFilters["price.max"] && !productFilters["price.min"]) {
        _.extend(selector, {
          "price.max": {
            $lte: parseFloat(productFilters["price.max"])
          }
        });
      }

      // filter with a price range
      if (productFilters["price.min"] && productFilters["price.max"]) {
        _.extend(selector, {
          $and: [ {
            "price.max": { $lte: parseFloat(productFilters["price.max"])}
          }, {
            "price.min": { $gte: parseFloat(productFilters["price.min"])}
          }]
        });
      }

      // filter by gte minimum weight
      if (productFilters["weight.min"] && !productFilters["weight.max"]) {
        _.extend(selector, {
          weight: {
            $gte: parseFloat(productFilters["weight.min"])
          }
        });
      }

      // filter by lte maximum weight
      if (productFilters["weight.max"] && !productFilters["weight.min"]) {
        _.extend(selector, {
          weight: {
            $lte: parseFloat(productFilters["weight.max"])
          }
        });
      }

      // filter with a weight range
      if (productFilters["weight.min"] && productFilters["weight.max"]) {
        _.extend(selector, {
          $and: [ {
            "weight.max": { $lte: parseFloat(productFilters["weight.max"])}
          }, {
            "weight.min": { $gte: parseFloat(productFilters["weight.min"])}
          }]
        });
      }
    }

    // products are always visible to owners
    if (!(Roles.userIsInRole(this.userId, ["owner"], shop._id) || shopAdmin)) {
      selector.isVisible = true;
    }

    // check quantity
    _.extend(selector, {
      isSoldOut: false
    });
    /*
    _.extend(selector, {
      "inventoryQuantity": {
        $gte: 0
      }
    });*/

    return Products.find(selector, {
      sort: sort,
      limit: productScrollLimit
    });
  }
});
