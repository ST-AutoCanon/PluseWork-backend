exports.GET_SIDEBAR_MENU_BY_ORG_ROLE = `
  SELECT label, path, icon 
  FROM sidebar_menu 
  WHERE FIND_IN_SET(?, roles)
`;
