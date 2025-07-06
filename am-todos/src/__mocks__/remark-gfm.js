// Mock remark-gfm plugin
const remarkGfm = () => {
  return (tree) => {
    // Mock implementation - just return the tree unchanged
    return tree;
  };
};

export default remarkGfm;