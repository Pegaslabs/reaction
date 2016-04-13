
Template.dashboardProductsList.inheritsHelpersFrom("productList"); // for media
Template.dashboardProductsList.inheritsHooksFrom("productList"); // needed to make products show up
Template.dashboardProductsList.inheritsHelpersFrom("gridContent"); // for price

Template.dashboardProductsList.helpers({
  products: function (data) { // override to show only this users products
    let SellerProducts = Meteor.subscribe("SellerProducts");
    if (SellerProducts.ready()) {
      //console.log("helper Template.dashboardProductsList.helpers using publication SellerProducts.");
      return ReactionCore.Collections.Products.find({userId: Meteor.userId()});
    }
  },
});
