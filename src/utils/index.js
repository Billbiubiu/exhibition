export const makeRadian = radian => {
  let makedRadian = radian % (Math.PI * 2);
  return makedRadian < 0 ? makedRadian + (Math.PI * 2) : makedRadian;
}
/**
* 转动工具，总是以锐角进行转动
* @param {*} source 当前角度
* @param {*} target 目标角度
* @returns 
*/
export const getRotation = (source, target) => {
 let makedSource = makeRadian(source);
 let makedTarget = makeRadian(target);
 const diff = makedTarget - makedSource;
 // 差值大于180度，需要反方向旋转
 if (diff > Math.PI) {
   return source - (Math.PI * 2 - diff);
 } else if (diff < -Math.PI) {
   return source + (Math.PI * 2 + diff);
 } else {
   return source + diff;
 }
};
